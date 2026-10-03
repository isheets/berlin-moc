"""Trips and congested link travel times from the MATSim Open Berlin scenario.

Trips come from the scenario's initial plans: synthetic persons carrying travel-survey diaries
(Monday to Thursday, clock times, no date). Link travel times come from its simulation output.
"""

import bisect
import gzip
import math
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import dataclass
from fnmatch import fnmatchcase
from pathlib import Path

import geopandas as gpd
import pandas as pd
from pyproj import Transformer
from shapely.geometry import Point
from shapely.prepared import prep

from . import config

VERSION = "v7.0"
SCENARIO = ("https://svn.vsp.tu-berlin.de/repos/public-svn/matsim/scenarios/countries/de/berlin/"
            f"berlin-{VERSION}/")
INPUT = SCENARIO + "input/"
OUTPUT = SCENARIO + f"output/berlin-{VERSION}-10pct/berlin-{VERSION}."
PLANS = f"berlin-{VERSION}-25pct.plans-initial.xml.gz"

MODES = {"walk": "walk", "bike": "bike", "pt": "pt", "car": "car_driver", "ride": "car_passenger"}
TRIP_COLUMNS = ["trip_id", "person_id", "age", "sex", "household_type", "departure_time",
                "origin_lon", "origin_lat", "destination_lon", "destination_lat",
                "origin_activity", "destination_activity", "home_lon", "home_lat",
                "survey_distance_km", "survey_duration_min"]
COUNT_COLUMNS = ["age_band", "sex", "household_type", "origin_activity", "destination_activity",
                 "mode", "within_berlin", "beeline_band", "trips"]
AGE_BANDS = [0, 3, 6, 10, 18, 30, 45, 65]
BEELINE_BANDS_KM = [0.5, 1, 2, 5, 10]

TO_WGS84 = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)


# Trips

@dataclass
class Leg:
    index: int                      # the leg's place in the plan, part of the trip id
    mode: str
    origin_activity: str
    destination_activity: str
    departure: int | None           # seconds after midnight
    origin: tuple[float, float]     # EPSG:25832
    destination: tuple[float, float]
    within_berlin: bool
    destination_element: ET.Element


def extract(groups: dict) -> tuple[dict[str, pd.DataFrame], pd.DataFrame]:
    """One pass over the plans: each group's legs (filters: ages, mode, from, to, either_end,
    household) with both ends inside Berlin, and every leg made by a Berlin resident, counted."""
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        facilities = load_facilities(download(INPUT + f"berlin-{VERSION}-facilities.xml.gz", workdir))
        boundary = berlin_boundary()
        plans = download(INPUT + PLANS, workdir)
        return tally(persons(plans), groups, facilities, boundary)


def tally(people, groups: dict, facilities: dict, boundary) -> tuple[dict, pd.DataFrame]:
    rows = {group: [] for group in groups}
    counts = Counter()
    for person, attrs in people:
        if "home_x" not in attrs or "age" not in attrs:
            continue
        resident = boundary.contains(Point(float(attrs["home_x"]), float(attrs["home_y"])))
        wanted = [group for group, filters in groups.items() if person_matches(attrs, filters)]
        if not (resident or wanted):
            continue
        for leg in legs(person, facilities, boundary):
            if resident:
                counts[count_key(leg, attrs)] += 1
            for group in wanted:
                if leg_matches(leg, groups[group]):
                    rows[group].append(trip_row(person, leg, attrs))
    trips = {group: pd.DataFrame(found, columns=TRIP_COLUMNS) for group, found in rows.items()}
    counted = pd.DataFrame([(*key, n) for key, n in counts.items()], columns=COUNT_COLUMNS)
    return trips, counted.sort_values(COUNT_COLUMNS[:-1], ignore_index=True)


def persons(plans: Path):
    """Each synthetic person of the population, with their attributes."""
    context = ET.iterparse(gzip.open(plans), events=("start", "end"))
    _, root = next(context)
    for event, person in context:
        if event == "end" and person.tag == "person":
            attrs = person_attributes(person)
            if attrs.get("subpopulation") == "person":
                yield person, attrs
            root.clear()


def download(url: str, workdir: Path) -> Path:
    path = workdir / url.rsplit("/", 1)[-1]
    print(f"  downloading {path.name}")
    urllib.request.urlretrieve(url, path)
    return path


def berlin_boundary():
    """Berlin as the union of its planning areas, in the plans' EPSG:25832; a meter's buffer
    closes slivers between neighboring areas."""
    areas = gpd.read_file(config.source_path("planning-areas")).to_crs("EPSG:25832")
    return prep(areas.union_all().buffer(1))


def load_facilities(path: Path) -> dict:
    coords = {}
    for _, elem in ET.iterparse(gzip.open(path)):
        if elem.tag == "facility":
            coords[elem.get("id")] = (float(elem.get("x")), float(elem.get("y")))
            elem.clear()
    return coords


def person_attributes(person) -> dict:
    attrs = person.find("attributes")
    return {} if attrs is None else {a.get("name"): a.text for a in attrs}


def person_matches(attrs: dict, filters: dict) -> bool:
    age = int(attrs.get("age", -1))
    low, high = filters["ages"]
    household = filters.get("household")
    return (age >= low and (high is None or age <= high)
            and (household is None or attrs.get("household_type") == household))


def legs(person, facilities: dict, boundary):
    """Each leg of the selected plan, with the activity and place at either end."""
    plan = next(p for p in person.findall("plan") if p.get("selected") == "yes")
    elements = list(plan)
    leaving = departures(elements[0::2])
    for i, leg in enumerate(elements):
        if leg.tag != "leg":
            continue
        origin, destination = elements[i - 1], elements[i + 1]
        ends = [location(act, facilities) for act in (origin, destination)]
        yield Leg(i // 2, MODES.get(leg.get("mode"), leg.get("mode")), activity(origin),
                  activity(destination), leaving[i // 2], *ends,
                  all(boundary.contains(Point(xy)) for xy in ends), destination)


def leg_matches(leg: Leg, filters: dict) -> bool:
    either = filters.get("either_end")
    return (leg.mode == filters["mode"] and leg.within_berlin and leg.departure is not None
            and fnmatchcase(leg.origin_activity, filters.get("from", "*"))
            and fnmatchcase(leg.destination_activity, filters.get("to", "*"))
            and (either is None or any(fnmatchcase(a, p) for p in either
                                       for a in (leg.origin_activity, leg.destination_activity))))


def trip_row(person, leg: Leg, attrs: dict) -> list:
    (o_lon, o_lat), (d_lon, d_lat) = (lon_lat(*xy) for xy in (leg.origin, leg.destination))
    home_lon, home_lat = lon_lat(float(attrs["home_x"]), float(attrs["home_y"]))
    # The distance and duration the respondent reported for this trip in the survey.
    return [f"{person.get('id')}-{leg.index}", person.get("id"), int(attrs["age"]),
            attrs.get("sex"), attrs.get("household_type"), clock(leg.departure),
            o_lon, o_lat, d_lon, d_lat, leg.origin_activity, leg.destination_activity,
            home_lon, home_lat, activity_attribute(leg.destination_element, "orig_dist"),
            activity_attribute(leg.destination_element, "orig_duration")]


def count_key(leg: Leg, attrs: dict) -> tuple:
    beeline_km = math.dist(leg.origin, leg.destination) / 1000
    return (age_band(int(attrs["age"])), attrs.get("sex"), attrs.get("household_type"),
            leg.origin_activity, leg.destination_activity, leg.mode, leg.within_berlin,
            beeline_band(beeline_km))


def age_band(age: int) -> str:
    """0-2, 3-5, ..., 65+."""
    i = bisect.bisect_right(AGE_BANDS, age) - 1
    return f"{AGE_BANDS[i]}+" if i == len(AGE_BANDS) - 1 else f"{AGE_BANDS[i]}-{AGE_BANDS[i + 1] - 1}"


def beeline_band(km: float) -> str:
    """<0.5, 0.5-1, ..., 10+ km in a straight line."""
    i = bisect.bisect_right(BEELINE_BANDS_KM, km)
    if i == 0:
        return f"<{BEELINE_BANDS_KM[0]:g}"
    if i == len(BEELINE_BANDS_KM):
        return f"{BEELINE_BANDS_KM[-1]:g}+"
    return f"{BEELINE_BANDS_KM[i - 1]:g}-{BEELINE_BANDS_KM[i]:g}"


def activity(act) -> str:
    """Activity type without MATSim's typical-duration suffix: edu_secondary_21600 → edu_secondary."""
    return re.sub(r"_\d+$", "", act.get("type"))


def activity_attribute(act, name: str) -> str | None:
    for attribute in act.iter("attribute"):
        if attribute.get("name") == name:
            return attribute.text
    return None


def location(act, facilities: dict) -> tuple[float, float]:
    if act.get("x") is not None:
        return float(act.get("x")), float(act.get("y"))
    return facilities[act.get("facility")]


def departures(activities: list) -> list[int | None]:
    """When each activity is left, on the clock the plans were written with. Leisure, shopping
    and dining carry only a duration: they start on arrival, the previous departure plus the
    diary's travel time. None for the last activity of the day."""
    leaving, previous = [], None
    for act in activities:
        arrival = None
        if act.get("start_time"):
            arrival = seconds(act.get("start_time"))
        elif previous is not None and activity_attribute(act, "orig_duration") is not None:
            arrival = previous + round(float(activity_attribute(act, "orig_duration")) * 60)
        if act.get("end_time"):
            previous = seconds(act.get("end_time"))
        elif act.get("max_dur") and arrival is not None:
            previous = arrival + seconds(act.get("max_dur"))
        else:
            previous = None
        leaving.append(previous)
    return leaving


def seconds(clock_time: str) -> int:
    h, m, s = (int(float(part)) for part in clock_time.split(":"))
    return h * 3600 + m * 60 + s


def clock(secs: int) -> str:
    """Seconds after midnight as HH:MM:SS; past midnight runs on (25:10:00)."""
    return f"{secs // 3600:02d}:{secs % 3600 // 60:02d}:{secs % 60:02d}"


def lon_lat(x: float, y: float) -> tuple[float, float]:
    lon, lat = TO_WGS84.transform(x, y)
    return round(lon, 6), round(lat, 6)


# Link travel times

EVENT = re.compile(r'time="([^"]+)" type="(entered link|left link|vehicle leaves traffic)"'
                   r'.*?link="([^"]+)".*?vehicle="([^"]+)"')


def car_links() -> pd.DataFrame:
    """Car links with their geometry (WKT, EPSG:25832) and free-flow attributes."""
    links = []
    for _, elem in ET.iterparse(stream(OUTPUT + "output_network.xml.gz")):
        if elem.tag == "link" and "car" in elem.get("modes").split(","):
            links.append((elem.get("id"), elem.get("from"), elem.get("to"),
                          float(elem.get("length")), float(elem.get("freespeed"))))
        if elem.tag in ("node", "link"):
            elem.clear()
    links = pd.DataFrame(links, columns=["link_id", "from_node", "to_node", "length_m",
                                         "freespeed_ms"])

    shapes = pd.read_csv(urllib.request.urlopen(INPUT + f"berlin-{VERSION}-network-linkGeometries.csv"))
    shapes = shapes[shapes["LinkId"].isin(set(links["link_id"]))]
    wkt = shapes["Geometry"].map(lambda g: "LINESTRING (" + ", ".join(
        f"{float(x):.1f} {float(y):.1f}" for x, y in re.findall(r"\(([^,]+),([^)]+)\)", g)) + ")")
    return links.merge(pd.DataFrame({"link_id": shapes["LinkId"], "wkt": wkt}), on="link_id")


def link_travel_times() -> pd.DataFrame:
    """Mean travel time per car link and hour, over the simulated cars that crossed it whole."""
    entered = {}
    total, count = defaultdict(float), defaultdict(int)
    for line in stream(OUTPUT + "output_events.xml.gz"):
        if "_car" not in line:
            continue
        match = EVENT.search(line)
        if not match or not match.group(4).endswith("_car"):
            continue
        time, kind, link, vehicle = match.groups()
        if kind == "entered link":
            entered[vehicle] = (link, float(time))
        elif kind == "left link":
            start = entered.pop(vehicle, None)
            if start and start[0] == link:
                key = (link, int(start[1] // 3600))
                total[key] += float(time) - start[1]
                count[key] += 1
        else:
            entered.pop(vehicle, None)
    rows = [(link, hour, round(total[(link, hour)] / n, 2), n) for (link, hour), n in count.items()]
    return pd.DataFrame(rows, columns=["link_id", "hour", "travel_time_s", "traversals"])


def stream(url: str):
    return gzip.open(urllib.request.urlopen(url), "rt")
