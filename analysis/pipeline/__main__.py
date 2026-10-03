"""python -m pipeline <command> [--sample N]

  fetch     download the inputs listed in config.yaml
  prepare   prepare both trip sets and build the 10-minute network
  graphs    build the OTP graph of each network
  route     route every trip by PT on both networks and by car
  results   write outputs/
  run       graphs, route and results
"""

import argparse

from . import config, coverage, feeds, fetch, matsim, otp, results, route, trips


def prepare() -> None:
    """Rebuilds only what is missing: the trip extracts and counts in one pass over the plans,
    the link times from several GB of simulation events, and the 10-minute feed."""
    config.GENERATED.mkdir(exist_ok=True)
    groups = config.groups()
    extracts = {group: config.ROOT / settings["trips"] for group, settings in groups.items()}
    if not all(path.exists() for path in [*extracts.values(), config.TRIP_COUNTS]):
        found, counts = matsim.extract({group: s["matsim"] for group, s in groups.items()})
        for group, table in found.items():
            table.to_csv(extracts[group], index=False)
        counts.to_csv(config.TRIP_COUNTS, index=False)
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
    parser.add_argument("command", choices=["fetch", "prepare", "graphs", "route", "results", "run"])
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


if __name__ == "__main__":
    main()
