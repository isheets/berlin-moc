"""The map layers the web page draws besides the planning areas: district outlines, the lines the
10-minute network adds trips to and the residents it brings near a frequent line, a sample of the
routed trips as straight lines, and dot-density layers of trips and minutes."""

import json
import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

from . import config, coverage, feeds, figures, results, trips

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
    dots = dot_layers(run)
    with open(run.results / "dots.json", "w") as f:
        json.dump(dots, f, separators=(",", ":"))
    print("map layers: districts, network, "
          + ", ".join(f"{len(lines[group]):,} {group} trip lines" for group in config.groups())
          + f"; {len(dots['rounds']):,} dot places: " + ", ".join(
              f"{name} " + "/".join(f"{len(codes) - codes.count('.'):,}" for codes in layer["groups"].values())
              for name, layer in dots["layers"].items()))


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


# Each routed trip line: its ends, its round, and its driving-distance band (an index into
# config.driving_edges()).
LINE_COLUMNS = ["origin_lon", "origin_lat", "destination_lon", "destination_lat", "round", "band"]
DOT_ROUNDS = 20            # dots fill their areas in this many rounds
DOT_ORIGIN = (13.0, 52.3)  # dot places are stored in 1/DOT_SCALE degrees from here
DOT_SCALE = 10_000         # about 10 m


def trip_lines(run: config.Run) -> dict:
    """A share of each group's routed trips, sampled within each home district, as straight lines
    (columns: LINE_COLUMNS). A trip's round is its place among the sampled trips from the same
    home area: the page draws one trip per area at a time, and areas with more trips keep drawing
    longer."""
    table = pd.read_csv(run.results / "trips.csv", dtype={"home_area": str})
    share = config.parameters()["trip_lines_share"]
    lines = {"columns": LINE_COLUMNS}
    for group in config.groups():
        mine = table[(table["group"] == group) & table["car_time"].notna()].merge(
            trips.load(group)[["trip_id", *trips.ENDS]], on="trip_id")
        mine = mine.groupby(mine["home_area"].str[:2], group_keys=False).sample(
            frac=share, random_state=1)
        values = {**{end: mine[end].round(4) for end in trips.ENDS},
                  "round": mine.groupby("home_area").cumcount(),
                  "band": results.driving_band(mine["car_km"]).cat.codes}
        lines[group] = rows(pd.DataFrame(values)[LINE_COLUMNS])
    return lines


def dot_layers(run: config.Run) -> dict:
    """The page's dot layers, each a weekday amount by the planning area trips start in and a
    category, on places all the layers share (see dot_places). A count layer has a dot per
    `per_dot` of it (config `dots.trips`); a share layer has the same density of dots everywhere
    (`dots.share_per_km2`), split as each area's amount is, so only the colors vary:
      modes    care trips and commutes by public transport, driving, or every other mode, from
               the extraction's counts of every mode (config `mode_counts`); a commute is a trip to
               or from work with no care destination at either end
      walking  (shares) compared trips, care and commutes together, by whether walking takes
               more than half their time by public transport ("walk_most") or not ("walk_less"):
               all of them, and each driving-distance band on its own, as for distance
      distance (shares) compared trips by group (care, commute): all of them, and each
               driving-distance band on its own ("0" for the first, as in config.driving_edges())"""
    settings = config.load()["dots"]
    areas = trips.planning_areas()
    places = inhabited(areas)
    rng = np.random.default_rng(1)

    table = pd.read_csv(run.results / "trips.csv", dtype={"origin_area": str})
    compared = table[table["car_time"].notna()]
    per_trip = 1 / config.parameters()["sample_share"]      # weekday trips a routed trip stands for

    # Each driving-distance band its own group, so picking one recolors the dots; categories
    # are the trips' groups.
    band = results.driving_band(compared["car_km"]).cat.codes.astype(str)
    by_band = {name: (compared if name == "all" else compared[band == name])
               .groupby(["origin_area", "group"]).size().rename_axis(["origin_area", "category"]) * per_trip
               for name in ["all", *sorted(band.unique(), key=int)]}

    # The same bands, for trips mostly walking, care trips and commutes together.
    known = compared[compared[f"pt_time_{TODAY}"].notna()]
    known = known.assign(category=np.where(known[f"pt_walk_{TODAY}"] > known[f"pt_time_{TODAY}"] / 2,
                                           "walk_most", "walk_less"))
    walking = {name: (known if name == "all" else known[band.loc[known.index] == name])
               .groupby(["origin_area", "category"]).size() * per_trip
               for name in by_band}

    count = {"per_dot": settings["trips"]}
    layers = {
        "modes": (mode_amounts(), count),
        "walking": (walking, {"per_km2": settings["share_per_km2"]}),
        "distance": (by_band, {"per_km2": settings["share_per_km2"]}),
    }
    return dot_places(layers, places, rng)


def mode_amounts() -> dict:
    """Care trips and commutes (trips to or from work with no care destination at either end), by
    origin area and mode as the page groups them (config `mode_counts.modes`, every other mode as
    "other"): the extraction's counts, scaled to weekday trips."""
    settings = config.load()["mode_counts"]
    counted = pd.read_csv(config.ROOT / settings["file"], dtype={"origin_area": str})
    named = {mode: name for name, modes in settings["modes"].items() for mode in modes}
    counted = counted.assign(category=counted["mode"].map(named).fillna("other"))
    kinds = counted["kinds"].str.split()
    per_trip = 1 / config.parameters()["sample_share"]
    groups = {"care": kinds.apply(lambda k: "care" in k), "commute": kinds.apply(lambda k: k == ["work"])}
    return {group: counted[mask].groupby(["origin_area", "category"])["trips"].sum() * per_trip
            for group, mask in groups.items()}


def dot_places(layers: dict, places: pd.Series, rng) -> dict:
    """Dot layers on one set of places. Each layer gives, for each group, amounts by (origin
    area, category), and its scale: {per_dot} for counts, a dot per that much, rounded at random;
    or {per_km2} for shares, that many dots per km² of the area's inhabited blocks, split by the
    area's shares. Each area's places spread evenly over its inhabited blocks, so dots don't
    overlap, and every layer and group fills them from the first: switching groups or layers
    recolors the same dots. Which dot is which category is random within an area.

    Written as `places`, [x, y, x, y, ...] in 1/DOT_SCALE degrees from DOT_ORIGIN; `rounds`, each
    place's order in its area (0 to DOT_ROUNDS), so the page can fill every area at once; and for
    each layer its categories, its scale and, by group, a string with a character per place: the
    index of its category, or "." for none."""
    dots = {}                                               # (layer, group): {area: categories}
    for name, (amounts, scale) in layers.items():
        for group, amount in amounts.items():
            if "per_km2" in scale:
                km2 = pd.Series(shapely.area(places.to_numpy()) / 1e6, index=places.index)
                counts = split(amount, (km2 * scale["per_km2"]).round())
            else:
                expected = amount / scale["per_dot"]
                counts = (np.floor(expected) + (rng.random(len(expected)) < expected % 1)).astype(int)
            here = dots[name, group] = {}
            for (area, category), n in counts.items():
                here.setdefault(area, []).extend([category] * n)

    categories = {name: sorted({c for (layer, _), by_area in dots.items() if layer == name
                                for found in by_area.values() for c in found})
                  for name in layers}
    xy, rounds = [], []
    codes = {key: [] for key in dots}
    for area in sorted(set().union(*dots.values()) & set(places.index)):
        n = max(len(by_area.get(area, [])) for by_area in dots.values())
        xy.append(spread(places[area], n, rng))
        rounds.extend(DOT_ROUNDS * i // n for i in range(n))
        for (name, group), by_area in dots.items():
            found = list(rng.permutation(by_area.get(area, [])))
            codes[name, group].extend([str(categories[name].index(c)) for c in found]
                                      + ["."] * (n - len(found)))

    xy = np.concatenate(xy)
    lon_lat = gpd.GeoSeries(gpd.points_from_xy(xy[:, 0], xy[:, 1]), crs=trips.METRIC_CRS).to_crs(4326)
    scaled = np.round((np.column_stack([lon_lat.x, lon_lat.y]) - DOT_ORIGIN) * DOT_SCALE).astype(int)
    return {
        "origin": DOT_ORIGIN, "scale": DOT_SCALE,
        "places": scaled.ravel().tolist(), "rounds": rounds,
        "layers": {name: {**scale, "categories": categories[name],
                          "groups": {group: "".join(codes[name, group]) for group in amounts}}
                   for name, (amounts, scale) in layers.items()},
    }


def split(amount: pd.Series, dots: pd.Series) -> pd.Series:
    """Each area's `dots` (at least one) split among its categories in proportion to `amount`
    (by area and category), largest remainders first, so the parts add up."""
    shares = amount / amount.groupby(level=0).transform("sum")
    wanted = shares * dots.clip(lower=1).reindex(shares.index.get_level_values(0)).to_numpy()
    counts = np.floor(wanted).astype(int)
    short = (dots.clip(lower=1).reindex(counts.index.get_level_values(0)).to_numpy()
             - counts.groupby(level=0).transform("sum"))
    rank = (wanted - counts).groupby(level=0).rank(ascending=False, method="first")
    return counts + (rank <= short).astype(int)


def spread(shape, n: int, rng, tries: int = 12) -> np.ndarray:
    """n points within `shape`, each the one of `tries` random candidates farthest from the points
    before it (Mitchell's best candidate): they spread out evenly instead of clumping, and any
    first k of them are spread too."""
    if n == 0:
        return np.empty((0, 2))
    pool = shapely.get_coordinates(gpd.GeoSeries([shape]).sample_points(n * tries, rng=rng).iloc[0])
    pool = rng.permutation(pool)
    points = np.empty((n, 2))
    points[0] = pool[0]
    for i in range(1, n):
        candidates = pool[i * tries:(i + 1) * tries]
        nearest = np.min(np.linalg.norm(candidates[:, None, :] - points[None, :i, :], axis=2), axis=1)
        points[i] = candidates[np.argmax(nearest)]
    return points


def inhabited(areas: gpd.GeoDataFrame) -> pd.Series:
    """Each planning area's inhabited blocks, as one shape (metric CRS), by area; the whole area
    where no block's center falls in it."""
    blocks = coverage.population_blocks()
    metric = areas.to_crs(trips.METRIC_CRS)
    located = blocks.sjoin(metric[["area", "geometry"]], predicate="within")
    shapes = located.groupby("area")["outline"].agg(lambda o: shapely.union_all(o.to_numpy()))
    whole = metric.set_index("area").geometry
    return pd.Series({area: shapes.get(area, shape) for area, shape in whole.items()})


def rows(frame: pd.DataFrame) -> list:
    """The frame's rows as lists, missing values as null."""
    return frame.astype(object).where(frame.notna(), None).to_numpy().tolist()


def simplified(geometry: gpd.GeoSeries) -> gpd.GeoSeries:
    """Simplified by SIMPLIFY_M meters, in the geometry's own CRS."""
    return geometry.to_crs(trips.METRIC_CRS).simplify(SIMPLIFY_M).to_crs(geometry.crs)
