"""python -m pipeline <command> [--sample N]

  fetch     download the inputs listed in config.yaml
  prepare   prepare both trip sets and build the 10-minute network
  graphs    build the OTP graph of each network
  route     route every trip by PT on both networks and by car
  results   write outputs/
  layers    write the map layers: districts, the 10-minute network, trip lines
  typical   draw each group's typical trips in full
  run       graphs, route, results, map layers and typical trips
"""

import argparse

from . import (config, coverage, feeds, fetch, layers, matsim, otp, results, route, trips,
               typical)


def prepare() -> None:
    """Rebuilds only what is missing: the trip extracts, counts and counts by mode and origin in
    one pass over the plans, the link times from several GB of simulation events, and the 10-minute feed."""
    config.GENERATED.mkdir(exist_ok=True)
    groups = config.groups()
    extracts = {group: config.ROOT / settings["trips"] for group, settings in groups.items()}
    by_mode = config.load()["mode_counts"]
    by_mode_path = config.ROOT / by_mode["file"]
    if not all(path.exists() for path in [*extracts.values(), config.TRIP_COUNTS, by_mode_path]):
        found, counts, legs = matsim.extract({group: s["matsim"] for group, s in groups.items()},
                                             by_mode["matsim"])
        # Only the missing files are written: the extracts already routed never change.
        tables = {**{extracts[group]: table for group, table in found.items()},
                  config.TRIP_COUNTS: counts, by_mode_path: trips.count_by_origin(legs)}
        for path, table in tables.items():
            if not path.exists():
                table.to_csv(path, index=False)
    for group in groups:
        trips.prepare(group)
    if not (config.DATA / "matsim-link-times.csv.gz").exists():
        matsim.car_links().to_csv(config.DATA / "matsim-links.csv.gz", index=False)
        matsim.link_travel_times().to_csv(config.DATA / "matsim-link-times.csv.gz", index=False)
    if not config.gtfs_path("ten_minute").exists():
        feeds.build_ten_minute()
        for network in config.NETWORKS:
            print(f"{network}: {coverage.share_covered(network):.1%} of residents near a stop "
                  "with a line every 10 minutes")


def graphs() -> None:
    for network in config.NETWORKS:
        otp.build_graph(network)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["fetch", "prepare", "graphs", "route", "results",
                                            "layers", "typical", "run"])
    parser.add_argument("--sample", type=int, help="route a random sample per group into sample/")
    args = parser.parse_args()
    run = config.Run(args.sample)

    if args.command == "fetch":
        fetch.fetch_all()
    if args.command == "prepare":
        prepare()
    if args.command in ("graphs", "run"):
        graphs()
    if args.command in ("route", "run"):
        route.route_all(run)
    if args.command in ("results", "run"):
        results.write_all(run)
    if args.command in ("layers", "run"):
        layers.write(run)
    if args.command in ("typical", "run"):
        typical.write(run)


if __name__ == "__main__":
    main()
