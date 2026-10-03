"""The local transport plan's measure of the 10-minute network: the share of residents who live
within 400 m (in dense areas) or 500 m, as the crow flies, of a stop where one line departs at
least six times an hour."""

import zipfile

import geopandas as gpd
import numpy as np

from . import config, feeds, trips


def share_covered(network: str) -> float:
    settings = config.load()["scenario"]["coverage"]
    blocks = population_blocks()
    stops = frequent_stops(network, settings["hours"])
    nearest = gpd.sjoin_nearest(blocks, stops, distance_col="distance")
    nearest = nearest[~nearest.index.duplicated()]
    covered = nearest["distance"] <= nearest["radius"]
    return float(nearest.loc[covered, "residents"].sum() / nearest["residents"].sum())


def population_blocks() -> gpd.GeoDataFrame:
    """Each inhabited block as its centroid, with its residents and walking radius."""
    settings = config.load()["scenario"]["coverage"]
    blocks = gpd.read_file(config.source_path("population"))
    blocks = blocks[blocks["ew2025"] > 0]
    dense = blocks["ew_ha_2025"] >= settings["dense_per_ha"]
    return gpd.GeoDataFrame(
        {"residents": blocks["ew2025"],
         "radius": np.where(dense, settings["radius_m"]["dense"], settings["radius_m"]["other"])},
        geometry=blocks.geometry.centroid, crs=blocks.crs).to_crs(trips.METRIC_CRS)


def frequent_stops(network: str, hours: list) -> gpd.GeoDataFrame:
    """Stops where some line departs on average at least six times an hour within `hours`."""
    day = config.service_day().strftime("%Y%m%d")
    start, end = hours
    with zipfile.ZipFile(config.gtfs_path(network)) as z:
        stops = feeds.read(z, "stops.txt")
        routes = feeds.read(z, "routes.txt")
        day_trips = feeds.read(z, "trips.txt")
        day_trips = day_trips[day_trips.service_id.isin(feeds.active_services(z, day))]
        ids = set(day_trips.trip_id)
        stop_times = feeds.read_filtered(z, "stop_times.txt", lambda t: t.trip_id.isin(ids))
    hour = stop_times.departure_time.str.split(":").str[0].astype(int)
    departures = (stop_times[(hour >= start) & (hour < end)]
                  .merge(day_trips[["trip_id", "route_id"]], on="trip_id")
                  .merge(routes[["route_id", "agency_id", "route_short_name"]], on="route_id"))
    per_hour = departures.groupby(["stop_id", "agency_id", "route_short_name"]).size() / (end - start)
    frequent = stops[stops.stop_id.isin(per_hour[per_hour >= 6].index.get_level_values("stop_id"))]
    return gpd.GeoDataFrame(geometry=gpd.points_from_xy(frequent.stop_lon.astype(float),
                                                        frequent.stop_lat.astype(float)),
                            crs="EPSG:4326").to_crs(trips.METRIC_CRS)
