"""OpenTripPlanner 2: building graphs, running a server, and asking it for itineraries."""

import json
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from contextlib import contextmanager

from . import config

PORT = 8080
ENDPOINT = f"http://localhost:{PORT}/otp/routers/default/index/graphql"
MEMORY = "-Xmx12G"

PT_MODES = "{mode: TRANSIT}, {mode: WALK}"
# Kiss-and-ride: walk to where the car can stop, drive, walk from where it drops off. Plain CAR
# snaps each end to the nearest drivable edge, which fails in car parks and one-way driveways.
CAR_MODES = "{mode: CAR, qualifier: PICKUP}"

# OTP counts boardings in maxTransfers, so max_rides passes through unchanged.
QUERY = """{ plan(
  from: {lat: %(from_lat)f, lon: %(from_lon)f}
  to: {lat: %(to_lat)f, lon: %(to_lon)f}
  date: "%(date)s" time: "%(time)s"
  transportModes: [%(modes)s]
  numItineraries: 50
  searchWindow: %(window)d
  walkSpeed: %(walk_speed)f
  maxTransfers: %(max_rides)d
  walkBoardCost: 0
  transferPenalty: 0
  walkReluctance: 1.0
  waitReluctance: 1.0
) { itineraries {
    startTime endTime duration
    legs { mode startTime endTime duration distance route { shortName }
           from { name } to { name } %(geometry)s }
} } }"""


def jar() -> str:
    return str(config.source_path("otp"))


def build_graph(network: str) -> None:
    graph = config.graph_dir(network)
    if (graph / "graph.obj").exists():
        return
    graph.mkdir(parents=True, exist_ok=True)
    shutil.copy(config.source_path(config.load()["scenario"]["osm"]), graph / "streets.osm.pbf")
    shutil.copy(config.gtfs_path(network), graph / "gtfs.zip")
    shutil.copy(config.OTP / "build-config.json", graph)
    print(f"building the {network} graph")
    with open(graph / "build.log", "w") as log:
        subprocess.run(["java", MEMORY, "-jar", jar(), "--build", "--save", str(graph)],
                       stdout=log, stderr=subprocess.STDOUT, check=True)


@contextmanager
def server(network: str):
    """An OTP server on the network's graph, checked to be that network, for the block."""
    if responding():
        raise RuntimeError(f"something already answers on port {PORT}; stop it first")
    graph = config.graph_dir(network)
    shutil.copy(config.OTP / "router-config.json", graph)
    log = open(graph / "server.log", "w")
    process = subprocess.Popen(["java", MEMORY, "-jar", jar(), "--load", str(graph), "--serve"],
                               stdout=log, stderr=subprocess.STDOUT)
    try:
        wait_until_ready(process)
        check_network(network)
        yield
    finally:
        process.terminate()
        process.wait(timeout=120)
        log.close()


def responding() -> bool:
    try:
        query("{ serviceTimeRange { start } }")
        return True
    except (urllib.error.URLError, OSError):
        return False


def wait_until_ready(process: subprocess.Popen, timeout_s: int = 900) -> None:
    started = time.monotonic()
    while not responding():
        if process.poll() is not None:
            raise RuntimeError("the OTP server exited while starting; see its server.log")
        if time.monotonic() - started > timeout_s:
            raise RuntimeError("the OTP server did not start in time")
        time.sleep(5)


def check_network(network: str) -> None:
    """The sentinel line departs its stop fewer than six times in the sentinel hour today, and
    at least six times in the scenario, at every one of its platforms there."""
    sentinel = config.load()["scenario"]["sentinel"]
    day = config.service_day().strftime("%Y%m%d")
    stops = query('{ stops(name: "%s") { name stoptimesForServiceDate(date: "%s") '
                  '{ pattern { route { shortName } } stoptimes { scheduledDeparture } } } }'
                  % (sentinel["stop"], day))["stops"]
    start = sentinel["hour"] * 3600
    per_platform = [sum(start <= time["scheduledDeparture"] < start + 3600
                        for pattern in stop["stoptimesForServiceDate"]
                        if pattern["pattern"]["route"]["shortName"] == sentinel["line"]
                        for time in pattern["stoptimes"])
                    for stop in stops if stop["name"] == sentinel["stop"]]
    per_platform = [count for count in per_platform if count]
    frequent = bool(per_platform) and min(per_platform) >= 6
    if not per_platform or frequent != (network != "today"):
        raise RuntimeError(f"the server is not on the {network} network: line {sentinel['line']} "
                           f"departs {sentinel['stop']} {per_platform} times in hour "
                           f"{sentinel['hour']}")


def query(body: str) -> dict:
    request = urllib.request.Request(ENDPOINT, data=json.dumps({"query": body}).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        payload = json.load(response)
    if "errors" in payload:
        raise RuntimeError(payload["errors"][0]["message"])
    return payload["data"]


def plan(trip, departure, walk_speed_kmh: float, modes: str, geometry: bool = False) -> list[dict]:
    """Itineraries for one trip departing at `departure` (a naive local datetime), with each
    leg's geometry for the car, or when asked."""
    parameters = config.parameters()
    body = QUERY % {
        "from_lat": trip.origin_lat, "from_lon": trip.origin_lon,
        "to_lat": trip.destination_lat, "to_lon": trip.destination_lon,
        "date": departure.strftime("%Y-%m-%d"), "time": departure.strftime("%H:%M:%S"),
        "modes": modes,
        "window": parameters["departure_window_min"] * 60,
        "walk_speed": walk_speed_kmh / 3.6,
        "max_rides": parameters["max_rides"],
        "geometry": "legGeometry { points }" if geometry or modes == CAR_MODES else "",
    }
    return query(body)["plan"]["itineraries"]


def decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """An encoded polyline (Google's format, 5 decimals) as [(lon, lat), ...]."""
    coords, i, lat, lon = [], 0, 0, 0
    while i < len(encoded):
        deltas = []
        for _ in range(2):
            shift = result = 0
            while True:
                byte = ord(encoded[i]) - 63
                i += 1
                result |= (byte & 0x1f) << shift
                shift += 5
                if byte < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lon += deltas[1]
        coords.append((lon / 1e5, lat / 1e5))
    return coords
