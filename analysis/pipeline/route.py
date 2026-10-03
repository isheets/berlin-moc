"""Route every trip by public transport and by car, and keep the itinerary each mode offers."""

import datetime
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd

from . import config, congestion, otp, trips

CHUNK = 200


def route_all(run: config.Run) -> None:
    """Both networks for PT, then the car once on the last. OTP starts only on a network with
    trips left to route."""
    run.routes.mkdir(parents=True, exist_ok=True)
    groups = list(config.groups())
    steps = [(network, group) for network in config.NETWORKS for group in groups]
    steps += [(None, group) for group in groups]
    for server_network in config.NETWORKS:
        server_steps = [(number, network, group)
                        for number, (network, group) in enumerate(steps, start=1)
                        if (network or config.NETWORKS[-1]) == server_network]
        if all(remaining(run, group, network).empty for _, network, group in server_steps):
            print(f"the {server_network} network is already routed")
            continue
        print(f"starting OTP on the {server_network} network")
        with otp.server(server_network):
            print(f"OTP is up and on the {server_network} network")
            for number, network, group in server_steps:
                print(f"[{number}/{len(steps)}]", end=" ")
                route_group(run, group, network)


def output_path(run: config.Run, group: str, network: str | None):
    return run.car_routes(group) if network is None else run.pt_routes(group, network)


def remaining(run: config.Run, group: str, network: str | None) -> pd.DataFrame:
    """The group's trips not yet in the output file."""
    path = output_path(run, group, network)
    todo = sample(trips.load(group), run.sample)
    if path.exists():
        todo = todo[~todo["trip_id"].isin(pd.read_csv(path, usecols=["trip_id"])["trip_id"])]
    return todo


def route_group(run: config.Run, group: str, network: str | None) -> None:
    """PT on `network`, or the car when `network` is None. Appends to the output file in chunks,
    so an interrupted run resumes where it stopped."""
    path = output_path(run, group, network)
    todo = remaining(run, group, network)
    label = f"{group} {'car' if network is None else 'PT ' + network}"
    if todo.empty:
        print(f"{label}: already routed")
        return

    route_one = car_trip if network is None else pt_trip
    started = time.monotonic()
    with ThreadPoolExecutor(config.parameters()["routing_threads"]) as pool:
        for start in range(0, len(todo), CHUNK):
            chunk = list(todo.iloc[start:start + CHUNK].itertuples())
            rows = pd.DataFrame(pool.map(route_one, chunk))
            rows.to_csv(path, mode="a", header=not path.exists(), index=False)
            done = start + len(chunk)
            elapsed = time.monotonic() - started
            left = (len(todo) - done) * elapsed / done
            print(f"\r{label}: {done:,} / {len(todo):,} ({done / len(todo):.0%}), "
                  f"{done / elapsed:.1f} trips/s, {left / 60:.0f} min left", end="", flush=True)
    print()


def sample(trip_table: pd.DataFrame, n: int | None) -> pd.DataFrame:
    return trip_table if n is None else trip_table.sample(min(n, len(trip_table)), random_state=1)


def departure(trip) -> datetime.datetime:
    """The diary departure on the service day; hours past 23 run into the next day."""
    h, m, s = (int(part) for part in trip.departure_time.split(":"))
    return config.service_day() + datetime.timedelta(hours=h, minutes=m, seconds=s)


def minutes(ms: int) -> float:
    return ms / 60000


def pt_trip(trip) -> dict:
    """The earliest-arriving itinerary with a ride that walks less than walking all the way.
    None such: no PT service."""
    leaves = departure(trip)
    leaves_ms = int(pd.Timestamp(leaves).tz_localize("Europe/Berlin").timestamp() * 1000)
    itineraries = otp.plan(trip, leaves, config.walk_speed_kmh(), otp.PT_MODES)

    walk_only = [it for it in itineraries if not rides(it)]
    direct_walk = min((it["duration"] for it in walk_only), default=None)
    qualifying = [it for it in itineraries if rides(it)
                  and (direct_walk is None or walking(it) < direct_walk)]
    row = {"trip_id": trip.trip_id,
           "direct_walk": round(direct_walk / 60, 2) if direct_walk is not None else None}
    if not qualifying:
        return row

    best = min(qualifying, key=lambda it: (it["endTime"], len(rides(it))))
    initial_wait = minutes(best["startTime"] - leaves_ms)
    window = config.parameters()["departure_window_min"]
    if not 0 <= initial_wait <= window:
        raise RuntimeError(f"trip {trip.trip_id}: itinerary leaves {initial_wait:.1f} min after "
                           f"the departure, outside the {window} min window")

    ride_legs = rides(best)
    in_vehicle = sum(leg["duration"] for leg in ride_legs) / 60
    total = minutes(best["endTime"] - leaves_ms)
    return row | {
        "pt_time": round(total, 2),
        "pt_walk": round(walking(best) / 60, 2),
        "pt_in_vehicle": round(in_vehicle, 2),
        "pt_wait": round(total - walking(best) / 60 - in_vehicle, 2),
        "pt_rides": len(ride_legs),
        "pt_legs": ";".join(f"{leg['route']['shortName']}: {leg['from']['name']} > {leg['to']['name']}"
                            for leg in ride_legs),
    }


def rides(itinerary: dict) -> list:
    return [leg for leg in itinerary["legs"] if leg["mode"] != "WALK" and leg["duration"] > 0]


def walking(itinerary: dict) -> float:
    return sum(leg["duration"] for leg in itinerary["legs"] if leg["mode"] == "WALK")


def car_trip(trip) -> dict:
    """The fastest itinerary that drives: walk to the curb, drive with MATSim's congestion, walk
    from the curb. None that drives: no car trip."""
    leaves = departure(trip)
    row = {"trip_id": trip.trip_id}
    driving = [it for it in otp.plan(trip, leaves, config.walk_speed_kmh(), otp.CAR_MODES)
               if drives(it)]
    if not driving:
        return row
    best = min(driving, key=lambda it: it["duration"])
    drive_legs = drives(best)

    free_flow = sum(leg["duration"] for leg in drive_legs) / 60
    geometry = [point for leg in drive_legs for point in otp.decode_polyline(leg["legGeometry"]["points"])]
    start = pd.Timestamp(drive_legs[0]["startTime"], unit="ms", tz="UTC").tz_convert("Europe/Berlin")
    hour = int((start.tz_localize(None) - config.service_day()) / datetime.timedelta(hours=1))
    drive, matched_share = congestion.congested_drive(geometry, hour, free_flow)
    walk = walking(best) / 60
    return row | {
        "car_time": round(walk + drive, 2),
        "car_walk": round(walk, 2),
        "car_drive": round(drive, 2),
        "car_drive_free_flow": round(free_flow, 2),
        "car_km": round(sum(leg["distance"] for leg in drive_legs) / 1000, 3),
        "car_matched_share": round(matched_share, 3),
    }


def drives(itinerary: dict) -> list:
    return [leg for leg in itinerary["legs"] if leg["mode"] == "CAR" and leg["distance"] > 0]
