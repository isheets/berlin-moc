"""The map layers the web page draws besides the planning areas: district outlines, the lines the
10-minute network adds trips to and the residents it brings near a frequent line, and a sample of
trips as straight lines."""

import json
import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

from . import config, coverage, feeds, figures, trips

TODAY, SCENARIO = config.NETWORKS
SIMPLIFY_M = 20            # meters, for outlines, lines and coverage areas
PRECISION = 5              # decimals in the GeoJSON coordinates, about a meter
BRANCH_M = 500             # a line's shape is drawn if it adds this much route to its longer shapes,
NEAR_M = 30                # counting route within this distance of them as already drawn
CLOSE_M = 15               # coverage areas: gaps up to twice this between blocks closed, for drawing


def write(run: config.Run) -> None:
    run.results.mkdir(parents=True, exist_ok=True)
    districts().to_file(run.results / "districts.geojson", driver="GeoJSON",
                        COORDINATE_PRECISION=PRECISION)
    network().to_file(run.results / "network.geojson", driver="GeoJSON",
                      COORDINATE_PRECISION=PRECISION)
    lines = trip_lines(run)
    with open(run.results / "trip-lines.json", "w") as f:
        json.dump(lines, f, separators=(",", ":"))
    print("map layers: districts, network, " + ", ".join(
        f"{len(rows):,} {group} trip lines" for group, rows in lines.items()))


def districts() -> gpd.GeoDataFrame:
    """The twelve districts, dissolved from the planning areas."""
    shapes = figures.districts().reset_index()
    code, name = shapes["district"].str.split(" - ", n=1, expand=True).T.to_numpy()
    return gpd.GeoDataFrame({"district": code, "name": name},
                            geometry=simplified(shapes.geometry), crs=shapes.crs)


def network() -> gpd.GeoDataFrame:
    """The lines the 10-minute network adds trips to, and the residential blocks it brings near a
    frequent line or leaves without one: one layer, told apart by `layer`."""
    return pd.concat([ten_minute_lines(), coverage_areas()], ignore_index=True)


def ten_minute_lines() -> gpd.GeoDataFrame:
    """Each line that gains trips, drawn along the shapes its added trips run on, with the trips
    added: branches stay, short turns and the way back along the same streets are left out."""
    with zipfile.ZipFile(config.gtfs_path(SCENARIO)) as z:
        added = feeds.read(z, "trips.txt").query(f"service_id == '{feeds.SERVICE_ID}'")
        routes = feeds.read(z, "routes.txt").set_index("route_id")
        shape_ids = set(added["shape_id"])
        points = feeds.read_filtered(z, "shapes.txt", lambda s: s["shape_id"].isin(shape_ids))

    points = (points.assign(order=points["shape_pt_sequence"].astype(int))
              .sort_values(["shape_id", "order"]))
    ids, index = np.unique(points["shape_id"], return_inverse=True)
    shapes = gpd.GeoSeries(shapely.linestrings(
        points[["shape_pt_lon", "shape_pt_lat"]].astype(float).to_numpy(), indices=index),
        index=ids, crs="EPSG:4326").to_crs(trips.METRIC_CRS)

    per_shape = added.groupby("shape_id")[["route_id"]].first()
    route = routes.loc[per_shape["route_id"]]
    per_shape["line"] = route["route_short_name"].to_numpy()
    per_shape["mode"] = np.where(route["route_type"].isin(feeds.MODES["tram"]), "tram", "bus")
    per_shape["geometry"] = shapes[per_shape.index]
    per_shape["length"] = shapes[per_shape.index].length
    lines = (gpd.GeoDataFrame(per_shape.loc[distinct_shapes(per_shape)], crs=trips.METRIC_CRS)
             .dissolve(by=["line", "mode"], as_index=False)[["line", "mode", "geometry"]])
    lines["added_trips"] = lines["line"].map(
        added["route_id"].map(routes["route_short_name"]).value_counts())
    lines["geometry"] = lines.geometry.simplify(SIMPLIFY_M)
    return lines.to_crs("EPSG:4326").assign(layer="ten_minute_line")


def distinct_shapes(shapes: pd.DataFrame) -> list:
    """Of each line's shapes, longest first, those with at least BRANCH_M of route farther than
    NEAR_M from the ones kept before them."""
    kept = []
    for _, line in shapes.sort_values("length", ascending=False).groupby("line", sort=False):
        drawn = None
        for shape_id, geometry in line["geometry"].items():
            if drawn is None or geometry.difference(drawn).length >= BRANCH_M:
                kept.append(shape_id)
                near = geometry.buffer(NEAR_M)
                drawn = near if drawn is None else drawn.union(near)
    return kept


def coverage_areas() -> gpd.GeoDataFrame:
    """Residential blocks near a line every 10 minutes only on the 10-minute network, and those
    near one on neither, with their share of residents: the measure of `coverage`."""
    blocks = coverage.population_blocks()
    today, scenario = (coverage.covered(blocks, network) for network in config.NETWORKS)
    statuses = {"newly_covered": ~today & scenario, "not_covered": ~today & ~scenario}
    total = blocks["residents"].sum()
    return gpd.GeoDataFrame(
        {"status": list(statuses),
         "resident_share": [round(blocks.loc[near, "residents"].sum() / total, 4)
                            for near in statuses.values()]},
        geometry=[shapely.union_all(blocks.loc[near, "outline"].buffer(CLOSE_M).to_numpy())
                  .buffer(-CLOSE_M).simplify(SIMPLIFY_M) for near in statuses.values()],
        crs=blocks.crs).to_crs("EPSG:4326").assign(layer="coverage")


def trip_lines(run: config.Run) -> dict:
    """A share of each group's trips, sampled within each home district, as straight lines:
    [lon, lat, lon, lat, round], where a trip's round is its place among the sampled trips from
    the same home area. The page draws one trip per area at a time, and areas with more trips keep
    drawing longer."""
    table = pd.read_csv(run.results / "trips.csv", dtype={"home_area": str},
                        usecols=["group", "trip_id", "home_area", "car_time"])
    share = config.parameters()["trip_lines_share"]
    lines = {}
    for group in config.groups():
        mine = table[(table["group"] == group) & table["car_time"].notna()].merge(
            trips.load(group)[["trip_id", *trips.ENDS]], on="trip_id")
        mine = mine.groupby(mine["home_area"].str[:2], group_keys=False).sample(
            frac=share, random_state=1)
        rounds = mine.groupby("home_area").cumcount().to_numpy()
        lines[group] = [[*ends, int(r)]
                        for ends, r in zip(mine[trips.ENDS].round(4).to_numpy().tolist(), rounds)]
    return lines


def simplified(geometry: gpd.GeoSeries) -> gpd.GeoSeries:
    """Simplified by SIMPLIFY_M meters, in the geometry's own CRS."""
    return geometry.to_crs(trips.METRIC_CRS).simplify(SIMPLIFY_M).to_crs(geometry.crs)
