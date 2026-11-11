"""Typical trips, drawn in full: each group's trips near its median on driving distance, the
PT:car time ratio and the share of PT time spent walking, routed again on today's network with
the geometry of every leg. The times are the published ones; the routing has to reproduce them."""

import json
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import shapely

from . import config, figures, otp, route, trips

TODAY = config.NETWORKS[0]
MEASURES = {"car_km": "driving distance", f"ratio_{TODAY}": "PT:car time ratio",
            "walk_share": "share of PT time spent walking"}
SIMPLIFY_DEG = 0.00002   # about 2 m


def write(run: config.Run) -> None:
    table = pd.read_csv(run.results / "trips.csv",
                        dtype={f"{end}_area": str for end in ("home", "origin", "destination")})
    window = config.parameters()["typical_window"]
    chosen, counts = [], {}
    for group in config.groups():
        mine = with_measures(figures.compared(table, group), group)
        chosen.append(typical(mine, window))
        counts[group] = {"compared_trips": len(mine), "typical_trips": len(chosen[-1])}
    chosen = pd.concat(chosen, ignore_index=True)
    names = trips.planning_areas().set_index("area")["area_name"]

    print("typical trips: " + ", ".join(f"{group} {n['typical_trips']} of {n['compared_trips']:,}"
                                        for group, n in counts.items()))
    drawn = []
    if not chosen.empty:   # a small sample may have none
        with otp.server(TODAY), ThreadPoolExecutor(config.parameters()["routing_threads"]) as pool:
            drawn = list(pool.map(lambda trip: draw(trip, names), chosen.itertuples()))

    rule = (f"within {window * 100:g} percentile points of the group's median on "
            + ", ".join(MEASURES.values()))
    with open(run.results / "typical-trips.json", "w") as f:
        json.dump({"rule": rule, "groups": counts, "trips": drawn}, f, ensure_ascii=False)


def with_measures(mine: pd.DataFrame, group: str) -> pd.DataFrame:
    """The trips with their walking share and the coordinates of each end."""
    mine = mine.merge(trips.load(group)[["trip_id", *trips.ENDS]], on="trip_id")
    return mine.assign(walk_share=mine[f"pt_walk_{TODAY}"] / mine[f"pt_time_{TODAY}"])


def typical(mine: pd.DataFrame, window: float) -> pd.DataFrame:
    """Trips whose percentile rank on every measure is within `window` of the median's."""
    ranks = mine[list(MEASURES)].rank(pct=True)
    near = (ranks - 0.5).abs().le(window).all(axis=1)
    return mine[near].join(ranks.add_prefix("rank_"))


def draw(trip, names: pd.Series) -> dict:
    """One typical trip with each mode's legs, checked against its published times."""
    _, pt = route.pt_itinerary(trip, geometry=True)
    car = route.car_itinerary(trip)
    leaves_ms = route.departure_ms(trip)
    pt_minutes = route.minutes(pt["endTime"] - leaves_ms) if pt else None
    car_km = sum(leg["distance"] for leg in route.drives(car)) / 1000 if car else None
    if pt_minutes is None or abs(pt_minutes - trip.pt_time_today) > 0.01 \
            or car_km is None or abs(car_km - trip.car_km) > 0.001:
        raise RuntimeError(f"trip {trip.trip_id}: routing again gave PT {pt_minutes} min and "
                           f"car {car_km} km, against the published {trip.pt_time_today} min "
                           f"and {trip.car_km} km")

    def end(which: str) -> dict:
        area = getattr(trip, f"{which}_area")
        return {"activity": getattr(trip, f"{which}_activity"), "area": area,
                "area_name": names.get(area)}

    return {
        "trip_id": trip.trip_id,
        "group": trip.group,
        "departure_time": trip.departure_time,
        "origin": end("origin"),
        "destination": end("destination"),
        "rank": {measure: round(getattr(trip, f"rank_{measure}"), 3) for measure in MEASURES},
        "ratio": {network: getattr(trip, f"ratio_{network}") for network in config.NETWORKS},
        "change": trip.change,
        "car": {"minutes": trip.car_time, "walk": trip.car_walk, "stops": trip.car_stops,
                "drive": trip.car_drive, "km": trip.car_km,
                "origin_end": trip.car_origin_end, "destination_end": trip.car_destination_end,
                "path": path(route.drives(car))},
        "pt": {"minutes": trip.pt_time_today, "walk": trip.pt_walk_today,
               "wait": trip.pt_wait_today, "in_vehicle": trip.pt_in_vehicle_today,
               "legs": [{"mode": leg["mode"].lower(),
                         "line": leg["route"]["shortName"] if leg["route"] else None,
                         "from": leg["from"]["name"], "to": leg["to"]["name"],
                         "start": round(route.minutes(leg["startTime"] - leaves_ms), 2),
                         "end": round(route.minutes(leg["endTime"] - leaves_ms), 2),
                         "path": path([leg])}
                        for leg in pt["legs"] if leg["duration"] > 0]},
    }


def path(legs: list) -> list:
    """The legs' geometry joined, simplified and rounded to about a meter, as [[lon, lat], ...]."""
    points = [point for leg in legs for point in otp.decode_polyline(leg["legGeometry"]["points"])]
    if len(points) > 1:
        points = shapely.get_coordinates(shapely.simplify(shapely.linestrings(points), SIMPLIFY_DEG))
    return [[round(float(lon), 5), round(float(lat), 5)] for lon, lat in points]
