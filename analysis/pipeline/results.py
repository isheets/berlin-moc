"""Turn the routed trips into the files the web page reads."""

import hashlib
import json
import zipfile
from fnmatch import fnmatchcase

import geopandas as gpd
import numpy as np
import pandas as pd

from . import config, coverage, feeds, figures, trips

AREA_COLUMNS = ["home_area", "origin_area", "destination_area"]
TODAY, SCENARIO = config.NETWORKS
HOUR_BANDS = [0, 6, 9, 13, 16, 19, 21, 24]


def write_all(run: config.Run) -> None:
    run.results.mkdir(parents=True, exist_ok=True)
    table = trip_table(run)

    areas = trips.planning_areas()
    areas["child_poverty"] = areas["area"].map(trips.child_poverty())
    areas["child_poverty_quintile"] = pd.qcut(areas["child_poverty"], 5, labels=False) + 1
    table["child_poverty_quintile"] = table["home_area"].map(
        areas.set_index("area")["child_poverty_quintile"])
    table.drop(columns=["district"]).to_csv(run.results / "trips.csv", index=False)

    parameters = config.parameters()
    summary = {"scenario": scenario_metadata(),
               "trip_counts": trip_counts(),
               # The fewest trips an area needs in zones.geojson: for its statistics, for its shares.
               "area_minimum_trips": {"statistics": parameters["min_area_trips"],
                                      "shares": parameters["min_share_trips"]},
               "groups": {group: group_summary(table[table["group"] == group], group)
                          for group in config.groups()}}
    with open(run.results / "summary.json", "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    zones = zone_table(table, areas)
    zones.to_file(run.results / "zones.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)

    figures.write_all(table, zones, run.results / "figures")
    print(json.dumps({g: s["networks"][SCENARIO] | {"change": s["change"]}
                      for g, s in summary["groups"].items()}, indent=2))


def trip_table(run: config.Run) -> pd.DataFrame:
    """One row per routed trip: PT time on each network, car time door to door, their ratios,
    and the change."""
    frames = []
    for group in config.groups():
        today = pd.read_csv(run.pt_routes(group, TODAY))
        scenario = pd.read_csv(run.pt_routes(group, SCENARIO))
        car = pd.read_csv(run.car_routes(group))
        table = (trips.load(group)
                 .merge(today[["trip_id", "pt_time", "pt_walk", "pt_wait", "pt_in_vehicle"]],
                        on="trip_id")
                 .merge(scenario[["trip_id", "pt_time", "pt_walk", "pt_wait", "pt_in_vehicle",
                                  "pt_rides"]],
                        on="trip_id", suffixes=(f"_{TODAY}", f"_{SCENARIO}"))
                 .merge(car[["trip_id", "car_walk", "car_drive", "car_km"]], on="trip_id"))
        table.insert(0, "group", group)
        frames.append(table)
    table = pd.concat(frames, ignore_index=True)
    ends = car_ends(table)   # replaces the routed walk to the curb
    table = table.drop(columns=["car_walk"]).join(ends)

    for network in config.NETWORKS:
        table[f"ratio_{network}"] = (table[f"pt_time_{network}"] / table["car_time"]).round(3)
    table["change"] = (table[f"pt_time_{SCENARIO}"] - table[f"pt_time_{TODAY}"]).round(2)
    table["ratio_change"] = (table[f"ratio_{SCENARIO}"] - table[f"ratio_{TODAY}"]).round(3)
    table["district"] = table["origin_area"].str[:2]          # where the trip starts
    keep = ["group", "trip_id", "age", "household_type", "departure_time",
            "straight_line_km", *AREA_COLUMNS, "origin_activity", "destination_activity",
            "survey_distance_km", "survey_duration_min",
            *[c for c in table.columns if c.startswith(("pt_", "car_", "ratio_"))],
            "change", "district"]
    return table[keep]


def car_ends(table: pd.DataFrame) -> pd.DataFrame:
    """What a car trip spends at either end besides driving, from the activity there: a drop-off
    or pick-up stop is either a dwell at the curb or parked, as drawn for that stop; every other
    end means walking between the door and a parked car, plus finding a space on arrival. At home
    only the share of cars kept on the street walks or searches, the rest park privately. Parked
    walks replace the routed walk to the curb where longer. car_walk stays None where routing
    found no car trip."""
    settings = config.parameters()["car_ends"]
    escort = settings["escort"]
    walk_m_per_min = config.walk_speed_kmh() * 1000 / 60
    leg = table["trip_id"].str.rsplit("-", n=1).str[1].astype(int)
    walk = pd.Series(0.0, index=table.index)
    stops = pd.Series(0.0, index=table.index)
    kinds = {}
    for end, step in (("origin", 0), ("destination", 1)):   # the leg's activities in the plan
        activity = table[f"{end}_activity"]
        curbside = activity.eq(escort["activity"]) & curbside_stop(
            table["person_id"], leg + step, escort["curbside_share"])
        rules = activity.map({a: parking_rule(a, settings["parked"]) for a in activity.unique()})
        street = np.where(activity.eq("home"),
                          home_street_share(table[f"{end}_lon"], table[f"{end}_lat"],
                                            settings["home_street_share"]), 1.0)
        walk += np.where(curbside, 0, street * rules.str.get("walk_m") / walk_m_per_min)
        search = street * rules.str.get("search_min") if end == "destination" else 0
        stops += np.where(curbside, settings["curbside_dwell_min"], search)
        kinds[f"car_{end}_end"] = np.where(curbside, "curbside", "parked")
    has_car = table["car_drive"].notna()
    car_walk = np.maximum(table["car_walk"], walk).where(has_car)
    return pd.DataFrame({
        **kinds,
        "car_walk": car_walk.round(2),
        "car_stops": stops.where(has_car).round(2),
        "car_time": (table["car_drive"] + car_walk + stops).round(2),
    }, index=table.index)


def curbside_stop(person: pd.Series, activity_index: pd.Series, share: float) -> pd.Series:
    """Whether each drop-off or pick-up stop is curbside, drawn once per stop from a stable hash
    of the person and the stop's place in their plan, so both trips touching it agree."""
    keys = person.astype(str) + ":" + activity_index.astype(str)
    return keys.map(lambda key: int(hashlib.md5(key.encode()).hexdigest()[:8], 16) / 16**8 < share)


def matches(activity: str, patterns: list) -> bool:
    return any(fnmatchcase(activity, p) for p in patterns)


def parking_rule(activity: str, rules: list) -> dict:
    """The first parked-end rule naming the activity."""
    return next(rule for rule in rules if matches(activity, rule["activities"]))


def home_street_share(lon: pd.Series, lat: pd.Series, shares: dict) -> np.ndarray:
    inner = gpd.read_file(config.source_path("inner-city")).union_all()
    within = gpd.GeoSeries(gpd.points_from_xy(lon, lat), crs="EPSG:4326").within(inner).to_numpy()
    return np.where(within, shares["inner"], shares["outer"])


def group_summary(table: pd.DataFrame, group: str) -> dict:
    has_car = table["car_time"].notna()
    with_car = table[has_car]
    summary = {
        "label": config.groups()[group]["label"],
        "description": config.groups()[group]["description"],
        "trips": len(table),
        "trips_per_weekday": per_weekday(len(table)),
        "no_car_trip_share": share(~has_car),
        "car_ends": {end: with_car[f"car_{end}_end"].value_counts(normalize=True).round(4).to_dict()
                     for end in ("origin", "destination")},
        "networks": {network: network_summary(with_car, network) for network in config.NETWORKS},
        "change": change_summary(with_car),
        "by_departure_hour": breakdown(with_car, hour_band(with_car["departure_time"])),
        "by_district": breakdown(with_car, with_car["district"]),
        "by_child_poverty_quintile": breakdown(with_car, with_car["child_poverty_quintile"]),
        "by_driving_distance": breakdown(with_car, driving_band(with_car["car_km"])),
    }
    if group == "care":
        summary["by_care_kind"] = breakdown(with_car, care_kind(with_car))
    if group == "commute":
        families = with_car[with_car["household_type"] == "multi_w_children"]
        summary["households_with_children"] = {
            "trips": len(families),
            "networks": {network: network_summary(families, network)
                         for network in config.NETWORKS},
            "change": change_summary(families)}
    return summary


def network_summary(table: pd.DataFrame, network: str) -> dict:
    ratio = table[f"ratio_{network}"].dropna()
    bands = ratio_band(ratio).value_counts(normalize=True, sort=False)
    return {
        "no_pt_service_share": share(table[f"pt_time_{network}"].isna()),
        "compared_trips": len(ratio),
        "median_ratio": rounded(ratio.median()),
        "share_by_ratio_band": {band: round(float(value), 4) for band, value in bands.items()},
        "median_pt_minutes": rounded(table[f"pt_time_{network}"].median()),
        "median_car_minutes": rounded(table.loc[ratio.index, "car_time"].median()),
        "median_car_km": rounded(table.loc[ratio.index, "car_km"].median()),
        "walking_most_share": share(table.loc[ratio.index, f"pt_walk_{network}"]
                                    > table.loc[ratio.index, f"pt_time_{network}"] / 2),
        "mean_minutes_by_stage": {
            "pt": {stage: rounded(table.loc[ratio.index, f"pt_{stage}_{network}"].mean())
                   for stage in ("walk", "wait", "in_vehicle")},
            "car": {stage: rounded(table.loc[ratio.index, f"car_{stage}"].mean())
                    for stage in ("walk", "stops", "drive")}},
    }


def ratio_band(ratio: pd.Series) -> pd.Series:
    """Each ratio's band, labelled "up to 1.5", "1.5 to 2.5", ..., "over 3.5"."""
    edges = config.parameters()["ratio_bands"]
    labels = [f"up to {edges[0]:g}"] + [f"{a:g} to {b:g}" for a, b in zip(edges, edges[1:])] \
        + [f"over {edges[-1]:g}"]
    return pd.cut(ratio, [0, *edges, np.inf], labels=labels)


def change_summary(table: pd.DataFrame) -> dict:
    paired = table.dropna(subset=["change"])
    hit = affected(paired)
    faster = paired[hit & (paired["change"] < 0)]
    worst = config.parameters()["ratio_bands"][-1]
    return {
        "paired_trips": len(paired),
        "affected_share": share(hit),
        "faster_trips": len(faster),
        "slower_trips": int(hit.sum()) - len(faster),
        "median_minutes_saved_when_faster": rounded(-faster["change"].median()),
        "mean_minutes_saved_per_trip": rounded(-paired["change"].mean()),
        "share_of_time_saved": round(float(-paired["change"].sum() / paired[f"pt_time_{TODAY}"].sum()), 4),
        "gained_pt_service": int((table[f"pt_time_{TODAY}"].isna()
                                  & table[f"pt_time_{SCENARIO}"].notna()).sum()),
        "lost_pt_service": int((table[f"pt_time_{TODAY}"].notna()
                                & table[f"pt_time_{SCENARIO}"].isna()).sum()),
        "median_ratio_change": rounded(table[f"ratio_{SCENARIO}"].median()
                                       - table[f"ratio_{TODAY}"].median()),
        "trips_leaving_worst_band": int(((paired[f"ratio_{TODAY}"] > worst)
                                         & (paired[f"ratio_{SCENARIO}"] <= worst)).sum()),
        "share_leaving_worst_band": share(paired.loc[paired[f"ratio_{TODAY}"] > worst,
                                                     f"ratio_{SCENARIO}"] <= worst),
        "mean_minutes_saved_per_trip_by_stage": {
            stage: rounded((paired[f"pt_{stage}_{TODAY}"] - paired[f"pt_{stage}_{SCENARIO}"]).mean())
            for stage in ("walk", "wait", "in_vehicle")},
    }


def breakdown(table: pd.DataFrame, by: pd.Series) -> list:
    """Today's median ratio, the share of trips mostly walking by public transport, and what the
    10-minute network changes, for each value of `by`."""
    rows = []
    for key, part in table.groupby(by, observed=True):
        paired = part.dropna(subset=["change"])
        hit = affected(paired)
        known = part[part[f"ratio_{TODAY}"].notna()]
        rows.append({"key": key if isinstance(key, str) else int(key), "trips": len(part),
                     f"median_ratio_{TODAY}": rounded(part[f"ratio_{TODAY}"].median()),
                     f"median_ratio_{SCENARIO}": rounded(part[f"ratio_{SCENARIO}"].median()),
                     "walking_most_share": share(known[f"pt_walk_{TODAY}"]
                                                 > known[f"pt_time_{TODAY}"] / 2),
                     "affected_share": share(hit),
                     "median_minutes_saved_when_faster": rounded(
                         -paired.loc[hit & (paired["change"] < 0), "change"].median()),
                     "mean_minutes_saved": rounded(-paired["change"].mean())})
    return rows


def hour_band(departure_time: pd.Series) -> pd.Series:
    hour = departure_time.str[:2].astype(int) % 24
    labels = [f"{a:02d}-{b:02d}" for a, b in zip(HOUR_BANDS, HOUR_BANDS[1:])]
    return pd.cut(hour, HOUR_BANDS, right=False, labels=labels)


def driving_band(km: pd.Series) -> pd.Series:
    """Each trip's driving-distance band, labeled by its edges (config driving_km_bands): "0-4",
    "4-8", "8+"."""
    edges = config.driving_edges()
    labels = [f"{a:g}-{b:g}" for a, b in zip(edges[:-2], edges[1:-1])] + [f"{edges[-2]:g}+"]
    return pd.cut(km, edges, right=False, labels=labels)


def care_kind(table: pd.DataFrame) -> pd.Series:
    """A drop-off or pick-up at either end makes an escort trip; the rest are daily shopping."""
    escort = table[["origin_activity", "destination_activity"]].eq("transport").any(axis=1)
    return pd.Series(np.where(escort, "escort", "daily_shopping"), index=table.index)


def affected(table: pd.DataFrame) -> pd.Series:
    return table["change"].abs() >= config.parameters()["min_change_min"]


def trip_counts() -> dict:
    """Trips by Berlin residents aged 18 or over, with both ends in Berlin and at least the
    minimum straight-line distance apart, as for the routed trips: each kind's share of all such
    trips, how many per weekday, and by which mode. A kind counts the activity at either end, so a
    trip between a care destination and work is both care and work; a commute is a work trip with
    no care destination at either end."""
    counts = pd.read_csv(config.TRIP_COUNTS)
    below_floor = f"<{config.parameters()['min_straight_line_km']:g}"
    if below_floor not in set(counts["beeline_band"]):
        raise ValueError(f"the distance floor is not the counts' first band edge ({below_floor} km)")
    adults = counts[~counts["age_band"].isin(["0-2", "3-5", "6-9", "10-17"])
                    & counts["within_berlin"] & (counts["beeline_band"] != below_floor)]
    ends = adults[["origin_activity", "destination_activity"]]
    escort = ends.eq("transport").any(axis=1)
    shopping = ends.eq("shop_daily").any(axis=1)
    work = ends.eq("work").any(axis=1)
    kinds = {"care": escort | shopping, "escort": escort, "daily_shopping": shopping & ~escort,
             "work": work, "commute": work & ~(escort | shopping)}
    result = {}
    for households, rows in (("all", adults),
                             ("with_children", adults[adults["household_type"] == "multi_w_children"])):
        everyone = rows["trips"].sum()
        result[households] = {}
        for kind, mask in kinds.items():
            part = rows[mask.loc[rows.index]]
            total = part["trips"].sum()
            result[households][kind] = {
                "share_of_trips": round(float(total / everyone), 4),
                "trips_per_weekday": per_weekday(total),
                "mode_shares": (part.groupby("mode")["trips"].sum() / total).round(4).to_dict()}
    return result


def zone_table(table: pd.DataFrame, areas: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Planning areas with, per group, the trips that start there. Areas with fewer than
    `min_area_trips` trips carry counts but no statistics. The share of their public transport
    time the 10-minute network saves needs `min_share_trips`. Between the groups:
    median_ratio_gap, the second group's median ratio today minus the first's, positive where
    public transport is more competitive for the first; and time_saved_share_gap, the first
    group's share saved minus the second's, in percentage points."""
    minimum = config.parameters()["min_area_trips"]
    share_minimum = config.parameters()["min_share_trips"]
    zones = areas.copy()
    for group in config.groups():
        mine = table[(table["group"] == group) & table["car_time"].notna()]
        by_area = mine.groupby("origin_area").agg(
            trips=("trip_id", "size"),
            **{f"median_ratio_{network}": (f"ratio_{network}", "median")
               for network in config.NETWORKS},
            mean_minutes_saved=("change", lambda c: -c.mean()),
            mean_ratio_reduction=("ratio_change", lambda c: -c.mean()),
            mean_pt_walk=(f"pt_walk_{TODAY}", "mean"),
            affected_share=("change", lambda c: (c.abs() >= config.parameters()["min_change_min"]).mean()),
        ).round(3)
        by_area.loc[by_area["trips"] < minimum, by_area.columns != "trips"] = np.nan
        paired = mine.dropna(subset=["change"]).groupby("origin_area").agg(
            saved=("change", lambda c: -c.sum()), time=(f"pt_time_{TODAY}", "sum"), n=("change", "size"))
        by_area["time_saved_share"] = (paired["saved"] / paired["time"]).where(
            paired["n"] >= share_minimum).round(4)
        by_area.columns = [f"{group}_{column}" for column in by_area.columns]
        zones = zones.merge(by_area, left_on="area", right_index=True, how="left")
        zones[f"{group}_trips"] = zones[f"{group}_trips"].fillna(0).astype(int)
    first, second = config.groups()
    zones["median_ratio_gap"] = (zones[f"{second}_median_ratio_{TODAY}"]
                                 - zones[f"{first}_median_ratio_{TODAY}"]).round(3)
    zones["time_saved_share_gap"] = ((zones[f"{first}_time_saved_share"]
                                      - zones[f"{second}_time_saved_share"]) * 100).round(2)
    zones["geometry"] = zones.geometry.simplify(0.00005, preserve_topology=True)
    return zones


def scenario_metadata() -> dict:
    scenario = config.load()["scenario"]
    ten_minute = scenario["ten_minute"]
    return {
        "service_day": str(scenario["service_day"]),
        "sample_share": config.parameters()["sample_share"],     # of residents, MATSim's sample
        "change": (f"every {' and '.join(ten_minute['modes'])} line at least every "
                   f"{ten_minute['max_gap_min']} minutes from {ten_minute['hours'][0]}:00 "
                   f"to {ten_minute['hours'][1]}:00"),
        **added_service(),
        "residents_near_a_line_every_10_minutes": {
            network: round(coverage.share_covered(network), 4) for network in config.NETWORKS},
        "sources": {name: {"url": s["url"], "license": s["license"]}
                    for name, s in config.load()["sources"].items()},
    }


def added_service() -> dict:
    """The trips the 10-minute network adds to today's timetable, and on how many lines."""
    with zipfile.ZipFile(config.gtfs_path(SCENARIO)) as z:
        added = feeds.read(z, "trips.txt").query(f"service_id == '{feeds.SERVICE_ID}'")
        routes = feeds.read(z, "routes.txt")
    lines = routes.loc[routes["route_id"].isin(added["route_id"]), "route_short_name"]
    return {"added_trips": len(added), "lines": int(lines.nunique())}


def per_weekday(sampled: int) -> int:
    return int(round(sampled / config.parameters()["sample_share"], -2))


def share(mask) -> float:
    mask = pd.Series(mask)
    return round(float(mask.mean()), 4) if len(mask) else None


def rounded(value) -> float | None:
    return None if pd.isna(value) else round(float(value), 3)
