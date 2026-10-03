import datetime
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DOWNLOADS = ROOT / "downloads"
GENERATED = ROOT / "generated"
OTP = ROOT / "otp"
SAMPLE = ROOT / "sample"

TRIP_COUNTS = DATA / "matsim-trip-counts.csv"

NETWORKS = ["today", "ten_minute"]


@lru_cache(maxsize=1)
def load() -> dict:
    with open(ROOT / "config.yaml") as f:
        return yaml.safe_load(f)


def service_day() -> datetime.datetime:
    day = load()["scenario"]["service_day"]
    return datetime.datetime(day.year, day.month, day.day)


def groups() -> dict:
    return load()["groups"]


def parameters() -> dict:
    return load()["parameters"]


def walk_speed_kmh() -> float:
    return parameters()["walk_speed_kmh"]


def source(name: str) -> dict:
    return load()["sources"][name]


def source_path(name: str) -> Path:
    return DOWNLOADS / source(name)["file"]


def gtfs_path(network: str) -> Path:
    if network == "today":
        return source_path(load()["scenario"]["gtfs"])
    return GENERATED / f"gtfs-{network}.zip"


def graph_dir(network: str) -> Path:
    return OTP / "graphs" / network


@dataclass(frozen=True)
class Run:
    """Where one run keeps its routes and results: the full run, or a random sample."""

    sample: int | None = None

    @property
    def results(self) -> Path:
        return (ROOT if self.sample is None else SAMPLE) / "results"

    @property
    def routes(self) -> Path:
        return self.results / "routes"

    def pt_routes(self, group: str, network: str) -> Path:
        return self.routes / f"pt-{group}-{network}.csv"

    def car_routes(self, group: str) -> Path:
        return self.routes / f"car-{group}.csv"
