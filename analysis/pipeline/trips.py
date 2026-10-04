import geopandas as gpd
import numpy as np
import pandas as pd

from . import config

METRIC_CRS = "EPSG:25833"
ENDS = ["origin_lon", "origin_lat", "destination_lon", "destination_lat"]


def prepared_path(group: str):
    return config.GENERATED / f"prepared-trips-{group}.csv"


def prepare(group: str) -> pd.DataFrame:
    """The group's trips by Berlin residents above the minimum straight-line distance, each end
    and the home assigned its planning area."""
    trips = pd.read_csv(config.ROOT / config.groups()[group]["trips"])
    trips["straight_line_km"] = straight_line_km(trips).round(3)
    kept = trips[trips["straight_line_km"] >= config.parameters()["min_straight_line_km"]].copy()

    areas = planning_areas()
    for end in ("home", "origin", "destination"):
        kept[f"{end}_area"] = assign_area(kept[f"{end}_lon"], kept[f"{end}_lat"], areas)
    kept = kept[kept["home_area"].notna()]

    print(f"{group}: {len(trips)} trips, {len(kept)} kept")
    kept.to_csv(prepared_path(group), index=False)
    return kept


def load(group: str) -> pd.DataFrame:
    return pd.read_csv(prepared_path(group), dtype={f"{end}_area": str
                                                    for end in ("home", "origin", "destination")})


def straight_line_km(trips: pd.DataFrame) -> pd.Series:
    origins = points(trips["origin_lon"], trips["origin_lat"])
    destinations = points(trips["destination_lon"], trips["destination_lat"])
    return pd.Series(origins.distance(destinations, align=False).to_numpy() / 1000,
                     index=trips.index)


def points(lon: pd.Series, lat: pd.Series) -> gpd.GeoSeries:
    return gpd.GeoSeries(gpd.points_from_xy(lon, lat), crs="EPSG:4326").to_crs(METRIC_CRS)


def planning_areas() -> gpd.GeoDataFrame:
    areas = gpd.read_file(config.source_path("planning-areas"))
    return areas[["plr_id", "plr_name", "bez", "geometry"]].rename(
        columns={"plr_id": "area", "plr_name": "area_name", "bez": "district"})


def assign_area(lon: pd.Series, lat: pd.Series, areas: gpd.GeoDataFrame) -> np.ndarray:
    """The nearest planning area within 50 m of each point, so a point on a boundary still
    lands; none for a point outside Berlin."""
    located = gpd.GeoDataFrame(geometry=points(lon, lat).to_numpy(), crs=METRIC_CRS)
    located = located.sjoin_nearest(areas[["area", "geometry"]].to_crs(METRIC_CRS),
                                    how="left", max_distance=50)
    return located[~located.index.duplicated()]["area"].to_numpy()


def child_poverty() -> pd.Series:
    """Share of under-15s living on basic income support (SGB II) by planning area, %,
    31 December 2024: status indicator S4 of the MSS 2025. Areas the source marks invalid
    (fewer than 300 residents, outliers) are missing."""
    raw = gpd.read_file(config.source_path("child-poverty"), ignore_geometry=True)
    raw = raw[raw["kom"] == "gültig"]
    return pd.Series(raw["s4"].to_numpy(), index=raw["plr_id"].to_numpy(), name="child_poverty")
