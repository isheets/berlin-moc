"""The 10-minute network: today's feed with added trips wherever a bus or tram line's regular
service leaves a gap of more than 10 minutes during the day. Each added trip copies the line's
nearest trip on the same stops, shifted in time; nothing already in the feed changes."""

import math
import zipfile

import numpy as np
import pandas as pd

from . import config

SERVICE_ID = "ten-minute"
PREFIX = "ten-minute:"   # on added trip ids, clear of the base feed's own
MODES = {"bus": ["3", *map(str, range(700, 800))], "tram": ["0", *map(str, range(900, 1000))]}


def build_ten_minute() -> None:
    settings = config.load()["scenario"]["ten_minute"]
    base, out = config.gtfs_path("today"), config.gtfs_path("ten_minute")
    day = config.service_day().strftime("%Y%m%d")

    with zipfile.ZipFile(base) as z:
        routes = mode_routes(z, settings["agency"], settings["modes"])
        trips = read(z, "trips.txt")
        trips = trips[trips.route_id.isin(routes.route_id)
                      & trips.service_id.isin(active_services(z, day))]
        ids = set(trips.trip_id)
        stop_times = read_filtered(z, "stop_times.txt", lambda t: t.trip_id.isin(ids))

    added_trips, added_stop_times = fill_gaps(trips, stop_times, settings)

    with zipfile.ZipFile(base) as z, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as feed:
        append(z, feed, "trips.txt", added_trips)
        append(z, feed, "stop_times.txt", added_stop_times)
        append(z, feed, "calendar_dates.txt", pd.DataFrame(
            [{"service_id": SERVICE_ID, "date": day, "exception_type": "1"}]))
        for name in z.namelist():
            if name not in {"trips.txt", "stop_times.txt", "calendar_dates.txt"}:
                feed.writestr(name, z.read(name))

    lines = routes.set_index("route_id").loc[added_trips.route_id.unique(), "route_short_name"]
    print(f"10-minute feed: {len(added_trips):,} trips added on {lines.nunique()} lines")
    check_ten_minute(out, day, settings)


def fill_gaps(trips: pd.DataFrame, stop_times: pd.DataFrame, settings: dict):
    """Copies of existing trips, placed evenly in every gap longer than `max_gap_min` that
    falls within `hours`, on each regular trip pattern of each line and direction."""
    stop_times = stop_times.assign(order=stop_times.stop_sequence.astype(int),
                                   seconds=to_seconds(stop_times.departure_time))
    stop_times = stop_times.sort_values(["trip_id", "order"])
    by_trip = stop_times.groupby("trip_id")
    trips = trips.set_index("trip_id").assign(pattern=by_trip.stop_id.agg(tuple),
                                              departs=by_trip.seconds.first())

    copies = []   # (trip copied, seconds to shift it by)
    for _, pattern in regular_patterns(trips, settings):
        departs = pattern["departs"].sort_values()
        for at in gap_fillers(departs.to_numpy(), settings):
            nearest = (departs - at).abs().idxmin()
            copies.append((nearest, round(at - departs[nearest])))

    times_of = dict(tuple(stop_times.groupby("trip_id")))
    added_trips, added_stop_times = [], []
    for k, (trip_id, shift) in enumerate(copies):
        new_id = f"{PREFIX}{k}:{trip_id}"
        trip = trips.loc[trip_id].drop(["pattern", "departs"])
        added_trips.append(trip.to_dict() | {"trip_id": new_id, "service_id": SERVICE_ID,
                                             "block_id": ""})
        times = times_of[trip_id]
        added_stop_times.append(times.assign(
            trip_id=new_id,
            arrival_time=to_clock(to_seconds(times.arrival_time) + shift),
            departure_time=to_clock(times.seconds + shift)))
    columns = [c for c in stop_times.columns if c not in ("order", "seconds")]
    return pd.DataFrame(added_trips), pd.concat(added_stop_times)[columns]


def regular_patterns(trips: pd.DataFrame, settings: dict):
    """Each line's trip patterns (same stops, same direction) with at least `min_trips` trips
    starting within `hours`; rarer patterns are depot runs, school trips and the like."""
    start, end = (hour * 3600 for hour in settings["hours"])
    for key, pattern in trips.groupby(["route_id", "direction_id", "pattern"]):
        if pattern["departs"].between(start, end, inclusive="left").sum() >= settings["min_trips"]:
            yield key, pattern


def gap_fillers(departs: np.ndarray, settings: dict) -> list:
    """Departure times that split each over-long gap within `hours` into equal parts."""
    start, end = (hour * 3600 for hour in settings["hours"])
    longest = settings["max_gap_min"] * 60
    times = []
    for a, b in zip(departs[:-1], departs[1:]):
        if b - a <= longest or b <= start or a >= end:
            continue
        parts = math.ceil((b - a) / longest)
        times += [t for t in a + (b - a) * np.arange(1, parts) / parts if start <= t < end]
    return times


def check_ten_minute(built, day: str, settings: dict) -> None:
    """On the service day, every regular pattern keeps within the longest gap, and only the
    chosen agency's lines of the chosen modes gained trips; none lost any."""
    with zipfile.ZipFile(config.gtfs_path("today")) as a, zipfile.ZipFile(built) as b:
        counts = pd.DataFrame({"today": trips_per_line(a, day), "built": trips_per_line(b, day)})
        routes = mode_routes(b, settings["agency"], settings["modes"])
        trips = read(b, "trips.txt")
        trips = trips[trips.route_id.isin(routes.route_id)
                      & trips.service_id.isin(active_services(b, day))]
        ids = set(trips.trip_id)
        stop_times = read_filtered(b, "stop_times.txt", lambda t: t.trip_id.isin(ids))

    counts = counts.fillna(0)
    assert (counts["built"] >= counts["today"]).all(), "a line lost trips"
    upgraded = set(zip(routes.agency_id, routes.route_short_name))
    changed = set(counts[counts["built"] != counts["today"]].index)
    assert changed <= upgraded, f"lines changed that are not upgraded: {sorted(changed - upgraded)}"

    stop_times = stop_times.assign(order=stop_times.stop_sequence.astype(int),
                                   seconds=to_seconds(stop_times.departure_time))
    by_trip = stop_times.sort_values(["trip_id", "order"]).groupby("trip_id")
    trips = trips.set_index("trip_id").assign(pattern=by_trip.stop_id.agg(tuple),
                                              departs=by_trip.seconds.first())
    for key, pattern in regular_patterns(trips, settings):
        assert not gap_fillers(np.sort(pattern["departs"].to_numpy()), settings), \
            f"a gap is left on {key[:2]}"


def mode_routes(z: zipfile.ZipFile, agency: str, modes: list) -> pd.DataFrame:
    routes = read(z, "routes.txt")
    types = {t for mode in modes for t in MODES[mode]}
    return routes[(routes.agency_id == agency) & routes.route_type.isin(types)]


def trips_per_line(z: zipfile.ZipFile, day: str) -> pd.Series:
    routes = read(z, "routes.txt")
    trips = read(z, "trips.txt")
    trips = trips[trips.service_id.isin(active_services(z, day))].merge(routes, on="route_id")
    return trips.groupby(["agency_id", "route_short_name"]).size()


def active_services(z: zipfile.ZipFile, day: str) -> set:
    """Service ids running on `day` (YYYYMMDD): the weekly calendar plus its exceptions."""
    calendar, exceptions = read(z, "calendar.txt"), read(z, "calendar_dates.txt")
    weekday = pd.Timestamp(day).day_name().lower()
    running = calendar[(calendar[weekday] == "1") & (calendar.start_date <= day)
                       & (calendar.end_date >= day)]
    exceptions = exceptions[exceptions.date == day]
    added = exceptions[exceptions.exception_type == "1"].service_id
    removed = exceptions[exceptions.exception_type == "2"].service_id
    return (set(running.service_id) | set(added)) - set(removed)


def to_seconds(clock: pd.Series) -> pd.Series:
    parts = clock.str.strip().str.split(":", expand=True).astype(int)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]


def to_clock(seconds: pd.Series) -> pd.Series:
    return seconds.map(lambda s: f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}")


def read(z: zipfile.ZipFile, name: str, **kwargs) -> pd.DataFrame:
    with z.open(name) as f:
        return pd.read_csv(f, dtype=str, keep_default_na=False, **kwargs)


def read_filtered(z: zipfile.ZipFile, name: str, keep) -> pd.DataFrame:
    with z.open(name) as f:
        chunks = pd.read_csv(f, dtype=str, keep_default_na=False, chunksize=2_000_000)
        return pd.concat(chunk[keep(chunk)] for chunk in chunks)


def append(z: zipfile.ZipFile, feed: zipfile.ZipFile, name: str, added: pd.DataFrame) -> None:
    """The base table as it is, then the added rows in its column order."""
    with z.open(name) as f:
        header = f.readline().decode("utf-8-sig").strip()
    columns = [c.strip('"') for c in header.split(",")]
    with z.open(name) as source, feed.open(name, "w") as target:
        last = b"\n"
        while chunk := source.read(1 << 20):
            target.write(chunk)
            last = chunk[-1:]
        if last != b"\n":
            target.write(b"\n")
        rows = added.reindex(columns=columns, fill_value="").to_csv(index=False, header=False)
        target.write(rows.encode())
