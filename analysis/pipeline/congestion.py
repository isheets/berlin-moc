"""Congested driving time for an OTP car route, from MATSim's simulated link travel times.

The route is sampled every STEP meters and each point matched to the nearest MATSim car link
within RADIUS meters that runs the same way. A point's ratio is its link's simulated travel time
in that hour over the link's empty-road time; unmatched points count as uncongested. OTP's
free-flow time, scaled by the mean ratio, is the congested time.
"""

from functools import lru_cache

import numpy as np
import pandas as pd
import shapely
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import LineString

from . import config

STEP = 10.0         # meters between route points
RADIUS = 20.0       # meters within which a link can match
MAX_ANGLE = 45.0    # degrees between route and link direction

TO_METRIC = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)


class Links:
    def __init__(self):
        links = pd.read_csv(config.DATA / "matsim-links.csv.gz", dtype=str)
        times = pd.read_csv(config.DATA / "matsim-link-times.csv.gz", dtype={"link_id": str})

        self.from_node = links["from_node"].to_numpy()
        self.to_node = links["to_node"].to_numpy()
        self.geometries = shapely.from_wkt(links["wkt"].to_numpy())
        self.tree = STRtree(self.geometries)

        # MATSim moves cars in whole seconds, so an empty link takes its free-flow time rounded up.
        empty = np.ceil(links["length_m"].astype(float) / links["freespeed_ms"].astype(float))
        row_of = pd.Series(np.arange(len(links)), index=links["link_id"])
        times = times[times["link_id"].isin(row_of.index)]
        rows = row_of[times["link_id"]].to_numpy()
        self.ratio = np.ones((len(links), int(times["hour"].max()) + 1))
        self.ratio[rows, times["hour"].to_numpy()] = np.maximum(
            times["travel_time_s"].to_numpy() / empty.to_numpy()[rows], 1.0)


@lru_cache(maxsize=1)
def links() -> Links:
    return Links()


def congested_drive(geometry: list, hour: int, free_flow_min: float) -> tuple[float, float]:
    """(congested minutes, share of the route matched to a MATSim link) for one drive.
    `geometry` is [(lon, lat), ...] and `hour` the local hour the drive starts."""
    if len(geometry) < 2:
        return free_flow_min, float("nan")
    net = links()
    lon, lat = np.array(geometry).T
    route = shapely.linestrings(*TO_METRIC.transform(lon, lat))
    matched = match(route, net)
    hour = min(hour, net.ratio.shape[1] - 1)
    ratios = np.array([net.ratio[j, hour] if j is not None else 1.0 for j in matched])
    matched_share = sum(j is not None for j in matched) / len(matched)
    return free_flow_min * ratios.mean(), matched_share


def match(route: LineString, net: Links) -> list:
    """The matched link for each route point, or None."""
    at = np.minimum(np.arange(int(route.length // STEP) + 1) * STEP, route.length)
    points = shapely.line_interpolate_point(route, at)
    headings = bearings(route, at)

    # Every (point, link) pair within RADIUS that runs the same way, in the tree's order.
    x, y = shapely.get_x(points), shapely.get_y(points)
    point, link = net.tree.query(shapely.box(x - RADIUS, y - RADIUS, x + RADIUS, y + RADIUS))
    distance = shapely.distance(net.geometries[link], points[point])
    near = distance <= RADIUS
    point, link, distance = point[near], link[near], distance[near]
    link_at = shapely.line_locate_point(net.geometries[link], points[point])
    turn = np.abs((bearings(net.geometries[link], link_at) - headings[point] + 180) % 360 - 180)
    aligned = turn <= MAX_ANGLE
    point, link, distance = point[aligned], link[aligned], distance[aligned]

    # Each point's nearest link; on a tie, the first in the tree's order.
    order = np.lexsort((np.arange(len(point)), distance, point))
    first = order[np.unique(point[order], return_index=True)[1]]
    best = np.full(len(points), -1)
    best[point[first]] = link[first]
    matched = [int(j) if j >= 0 else None for j in best]

    # A match joined to neither neighbor is a crossing street caught at a junction.
    runs = [j for i, j in enumerate(matched) if j is not None and (i == 0 or matched[i - 1] != j)]
    joined = lambda a, b: net.to_node[a] == net.from_node[b]
    isolated = {runs[i] for i in range(1, len(runs) - 1)
                if not joined(runs[i - 1], runs[i]) and not joined(runs[i], runs[i + 1])}
    return [None if j in isolated else j for j in matched]


def bearings(lines, at: np.ndarray) -> np.ndarray:
    a = shapely.line_interpolate_point(lines, np.maximum(at - 1, 0))
    b = shapely.line_interpolate_point(lines, np.minimum(at + 1, shapely.length(lines)))
    dx, dy = shapely.get_x(b) - shapely.get_x(a), shapely.get_y(b) - shapely.get_y(a)
    return np.degrees(np.arctan2(dx, dy)) % 360
