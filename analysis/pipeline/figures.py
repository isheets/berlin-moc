"""Static figures, for the README and for sharing; the web page draws its own from the data."""

from functools import lru_cache

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib import colormaps  # noqa: E402
from matplotlib.cm import ScalarMappable  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap, Normalize  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

from . import config, trips  # noqa: E402

DPI = 200
TEXT = "0.1"
MUTED = "0.45"
NO_DATA = "0.82"
NO_CHANGE = "#fbfaf7"
LAND = "#f7f6f4"
DISTRICT_EDGE = "#b9b3ab"
# One hue, lighter group by group: the care trips, the subject, darker.
GROUP_COLORS = {"care": "#34495a", "commute": "#9aa9b6"}
ROADS = {"motorway": (1.2, "0.55"), "trunk": (1.2, "0.55"), "primary": (0.7, "0.68"),
         "secondary": (0.45, "0.78")}
RATIO_LABEL = "PT:car time ratio"
TODAY, SCENARIO = config.NETWORKS
NETWORK_LABELS = {TODAY: "Today", SCENARIO: "10-minute network"}

# YlOrRd without its palest end, which vanishes against the ground.
RATIO_CMAP = LinearSegmentedColormap.from_list(
    "ratio", colormaps["YlOrRd"](np.linspace(0.18, 1.0, 256)))
# Reductions only: one hue, light to dark.
REDUCTION_CMAP = LinearSegmentedColormap.from_list(
    "reduction", colormaps["Blues"](np.linspace(0.2, 0.95, 256)))

plt.rcParams.update({"font.family": "sans-serif", "font.size": 9, "text.color": TEXT,
                     "axes.labelcolor": TEXT, "xtick.color": MUTED, "ytick.color": MUTED,
                     "axes.edgecolor": MUTED, "axes.spines.top": False,
                     "axes.spines.right": False})


def write_all(table, zones: gpd.GeoDataFrame, folder) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    # Today's network
    ratio_distribution(table).savefig(folder / "ratio-distribution.png", dpi=DPI)
    time_split(table).savefig(folder / "time-split.png", dpi=DPI)
    ratio_by_distance(table).savefig(folder / "ratio-by-distance.png", dpi=DPI)
    ratio_map(zones).savefig(folder / "ratio-map.png", dpi=DPI)
    poverty_ratio(table).savefig(folder / "child-poverty-ratio.png", dpi=DPI)
    # Today against the 10-minute network
    ratio_bands(table).savefig(folder / "ratio-bands.png", dpi=DPI)
    ratio_change_by_distance(table).savefig(folder / "ratio-change-by-distance.png", dpi=DPI)
    change_split(table).savefig(folder / "change-split.png", dpi=DPI)
    change_map(zones).savefig(folder / "change-map.png", dpi=DPI)
    poverty_change(table).savefig(folder / "child-poverty-change.png", dpi=DPI)
    plt.close("all")


def ratio_distribution(table):
    """One box per group, today: the middle half of trips, whiskers to 1.5 box-widths, trips
    beyond as points."""
    fig, ax = plt.subplots(figsize=(8, 2), layout="constrained")
    groups = config.groups()
    for row, (group, settings) in enumerate(reversed(groups.items())):
        color = GROUP_COLORS[group]
        ratio = compared(table, group)[f"ratio_{TODAY}"]
        ax.boxplot(ratio, positions=[row], vert=False, widths=0.28, patch_artist=True,
                   flierprops={"marker": "o", "markersize": 2.5, "markeredgewidth": 0,
                               "markerfacecolor": color, "alpha": 0.35},
                   boxprops={"facecolor": color, "edgecolor": color, "linewidth": 0},
                   medianprops={"color": "white", "linewidth": 1.5},
                   whiskerprops={"color": color, "linewidth": 1},
                   capprops={"color": color, "linewidth": 1})
        ax.text(ratio.median(), row + 0.22, f"{ratio.median():.1f}", ha="center",
                fontsize=8, color=MUTED)
    ax.set_yticks(range(len(groups)), [s["label"] for s in reversed(groups.values())])
    ax.axvline(1, color=MUTED, linewidth=0.6, linestyle=(0, (2, 2)))
    ax.text(1.05, len(groups) - 0.42, "parity", ha="left", va="top", fontsize=8, color=MUTED)
    ax.set_xlim(0, None)
    ax.set_ylim(-0.5, len(groups) - 0.4)
    ax.set_xlabel(RATIO_LABEL)
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0, labelcolor=TEXT)
    return fig


def ratio_map(zones):
    values = shared_values(zones, f"median_ratio_{TODAY}")
    norm = Normalize(*np.nanpercentile(values, [2, 98])) if has_data(values) else Normalize(1, 3)
    fig, axes = map_panels()
    for ax, group in zip(axes, config.groups()):
        column = zones[f"{group}_median_ratio_{TODAY}"]
        draw_areas(ax, zones, column, RATIO_CMAP, norm)
    colorbar = fig.colorbar(ScalarMappable(norm, RATIO_CMAP), ax=axes, shrink=0.55,
                            label=f"{RATIO_LABEL}\n(median, by the area trips start in)")
    map_legend(colorbar, [area_key(NO_DATA, too_few_trips())])
    credit(fig)
    return fig


def change_map(zones):
    """How far the 10-minute network lowers the ratio; areas where no trip changed are set apart
    from missing data."""
    values = shared_values(zones, "mean_ratio_reduction")
    top = max(np.nanpercentile(values, 98), 0.05) if has_data(values) else 0.5
    norm = Normalize(0, top)
    fig, axes = map_panels()
    for ax, group in zip(axes, config.groups()):
        reduction = zones[f"{group}_mean_ratio_reduction"]
        unchanged = zones[f"{group}_affected_share"] == 0
        draw_areas(ax, zones, reduction.where(~unchanged), REDUCTION_CMAP, norm,
                   neutral=zones[unchanged])
    colorbar = fig.colorbar(ScalarMappable(norm, REDUCTION_CMAP), ax=axes, shrink=0.55,
                            label=f"Reduction in {RATIO_LABEL}\n(mean per trip, by the area trips start in)")
    map_legend(colorbar, [area_key(NO_CHANGE, "No trip changed"),
                          area_key(NO_DATA, too_few_trips())])
    credit(fig)
    return fig


def time_split(table):
    """Mean minutes per trip by public transport on each network and by car, split into what
    the time is spent on."""
    stages = {"Walk": ("pt_walk", "car_walk"), "Wait or park": ("pt_wait", "car_stops"),
              "Ride or drive": ("pt_in_vehicle", "car_drive")}
    shades = {"Walk": "0.78", "Wait or park": "0.6", "Ride or drive": "0.3"}
    groups = config.groups()
    fig, axes = plt.subplots(len(groups), 1, figsize=(8, 2.1 * len(groups)), layout="constrained",
                             sharex=True)
    for ax, (group, settings) in zip(axes, groups.items()):
        mine = compared(table, group)
        rows = [(f"PT, {label.lower()}", [mine[f"{pt}_{network}"].mean() for pt, _ in stages.values()])
                for network, label in NETWORK_LABELS.items()]
        rows.append(("Car", [mine[car].mean() for _, car in stages.values()]))
        for y, (label, minutes) in enumerate(reversed(rows)):
            left = 0
            for stage, value in zip(stages, minutes):
                ax.barh(y, value, left=left, height=0.6, color=shades[stage], label=stage)
                if value >= 2.5:   # minutes; narrower segments have no room for a label
                    ax.text(left + value / 2, y, f"{value / sum(minutes):.0%}", ha="center",
                            va="center", fontsize=7,
                            color="white" if stage == "Ride or drive" else TEXT)
                left += value
            ax.text(left + 0.4, y, f"{left:.0f} min", va="center", fontsize=8, color=MUTED)
        ax.set_yticks(range(len(rows)), [label for label, _ in reversed(rows)])
        ax.set_title(settings["label"], fontsize=10, loc="left")
        ax.spines["left"].set_visible(False)
        ax.tick_params(axis="y", length=0, labelcolor=TEXT)
    axes[-1].set_xlabel("Minutes per trip (mean)")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles[:len(stages)], labels[:len(stages)], loc="outside upper center",
               ncols=len(stages), frameon=False)
    return fig


DISTANCE_EDGES = config.driving_edges()


def ratio_by_distance(table):
    """Today's median ratio by driving distance; each marker's area is the band's share of the
    group's trips."""
    positions = np.arange(len(DISTANCE_EDGES) - 1)
    area_per_percent = 12   # marker area in points², per percent of the group's trips
    fig, ax = plt.subplots(figsize=(8, 3.4), layout="constrained")
    highest = 1
    for group, settings in config.groups().items():
        by_band = distance_bands(compared(table, group))
        share = by_band.size() / by_band.size().sum() * 100
        medians = by_band[f"ratio_{TODAY}"].median()
        highest = max(highest, medians.max())
        color = GROUP_COLORS[group]
        ax.plot(positions, medians, color=color, linewidth=1.2, zorder=2,
                label=settings["label"])
        # Commute bubbles slightly see-through, so a care bubble beneath still shows.
        ax.scatter(positions, medians, s=share * area_per_percent, color=color,
                   alpha=0.9 if group == "commute" else 1, edgecolor="white", linewidth=0.6,
                   zorder=3)

    ax.axhline(1, color=MUTED, linewidth=0.6, linestyle=(0, (2, 2)))
    ax.set_ylabel(f"{RATIO_LABEL} (median)")
    ax.set_ylim(0.5, highest * 1.35)   # headroom for the legends
    distance_axis(ax, positions)

    sizes = [plt.scatter([], [], s=pct * area_per_percent, color=MUTED, edgecolor="white")
             for pct in (5, 15, 25)]
    groups = ax.legend(frameon=False, loc="upper right")
    ax.add_artist(groups)
    ax.legend(sizes, ["5%", "15%", "25%"], title="Share of the group's trips", frameon=False,
              loc="upper center", ncols=3, fontsize=8, title_fontsize=8, borderpad=0.2)
    return fig


def ratio_change_by_distance(table):
    """How far the 10-minute network lowers the ratio, by driving distance."""
    positions = np.arange(len(DISTANCE_EDGES) - 1)
    fig, ax = plt.subplots(figsize=(8, 3.2), layout="constrained")
    for group, settings in config.groups().items():
        reduction = -distance_bands(compared(table, group))["ratio_change"].mean()
        ax.plot(positions, reduction, color=GROUP_COLORS[group], linewidth=1.2, marker="o",
                markersize=5, markeredgecolor="white", label=settings["label"])
    ax.axhline(0, color=MUTED, linewidth=0.6)
    ax.set_ylabel(f"Reduction in {RATIO_LABEL}\n(mean per trip)")
    distance_axis(ax, positions)
    ax.legend(frameon=False, loc="upper right")
    return fig


def distance_bands(trips_table):
    return trips_table.groupby(pd.cut(trips_table["car_km"], DISTANCE_EDGES,
                                      right=False), observed=False)


def distance_axis(ax, positions) -> None:
    """Ticks on the band boundaries, so each band sits between the distances that bound it."""
    ax.set_xticks(positions - 0.5, [f"{edge:g}" for edge in DISTANCE_EDGES[:-1]])
    ax.set_xlim(-0.5, positions[-1] + 0.5)
    ax.set_xlabel("Driving distance, km")


def ratio_bands(table):
    """Each group's trips by ratio band, today and on the 10-minute network."""
    edges = config.parameters()["ratio_bands"]
    labels = [f"up to {edges[0]:g}"] + [f"{a:g} to {b:g}" for a, b in zip(edges, edges[1:])] \
        + [f"over {edges[-1]:g}"]
    colors = RATIO_CMAP(np.linspace(0.1, 0.9, len(labels)))
    rows = []
    for group, settings in config.groups().items():
        mine = compared(table, group)
        for network, network_label in NETWORK_LABELS.items():
            bands = pd.cut(mine[f"ratio_{network}"], [0, *edges, np.inf], labels=labels)
            rows.append((f"{settings['label']}, {network_label.lower()}",
                         bands.value_counts(normalize=True, sort=False) * 100))

    fig, ax = plt.subplots(figsize=(8, 1.4 * len(config.groups())), layout="constrained")
    networks = len(NETWORK_LABELS)   # rows per group, then a gap
    y_positions = [g * (networks + 0.5) + n for g in range(len(config.groups()))
                   for n in range(networks)]
    for y, (label, shares) in zip(reversed(y_positions), rows):
        left = 0
        for band, color in zip(labels, colors):
            value = shares[band]
            ax.barh(y, value, left=left, height=0.75, color=color, edgecolor="white",
                    linewidth=1, label=band if y == y_positions[-1] else None)
            if value >= 6:
                dark = band == labels[-1]
                ax.text(left + value / 2, y, f"{value:.0f}%", ha="center", va="center",
                        fontsize=7, color="white" if dark else TEXT)
            left += value
    ax.set_yticks(list(reversed(y_positions)), [label for label, _ in rows])
    ax.set_xlim(0, 100)
    ax.set_xlabel("Trips, %")
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0, labelcolor=TEXT)
    fig.legend(*ax.get_legend_handles_labels(), loc="outside upper center", ncols=len(labels),
               frameon=False, title=RATIO_LABEL, title_fontsize=8)
    return fig


def change_split(table):
    """Minutes the 10-minute network saves per trip, by what the time is spent on."""
    stages = {"Walking": "walk", "Waiting": "wait", "Riding": "in_vehicle"}
    fig, ax = plt.subplots(figsize=(7, 3.2), layout="constrained")
    width = 0.8 / len(config.groups())
    positions = np.arange(len(stages) + 1)
    for offset, (group, settings) in zip(group_offsets(width), config.groups().items()):
        mine = compared(table, group)
        saved = [(mine[f"pt_{stage}_{TODAY}"] - mine[f"pt_{stage}_{SCENARIO}"]).mean()
                 for stage in stages.values()]
        saved.append(-mine["change"].mean())
        ax.bar(positions + offset, saved, width, color=GROUP_COLORS[group],
               label=settings["label"])
    ax.axhline(0, color=MUTED, linewidth=0.6)
    ax.axvline(len(stages) - 0.5, color="0.85", linewidth=0.6)
    ax.set_xticks(positions, [*stages, "Door to door"])
    ax.set_ylabel("Minutes saved per trip (mean)")
    fig.legend(*ax.get_legend_handles_labels(), loc="outside upper center", ncols=len(config.groups()),
               frameon=False)
    return fig


def poverty_ratio(table):
    """Today's median ratio by the child poverty of the home area."""
    fig, ax = plt.subplots(figsize=(6, 3.2), layout="constrained")
    width = 0.8 / len(config.groups())
    for offset, (group, settings) in zip(group_offsets(width), config.groups().items()):
        ratio = compared(table, group).groupby("child_poverty_quintile")[f"ratio_{TODAY}"].median()
        ax.bar(ratio.index + offset, ratio, width, color=GROUP_COLORS[group],
               label=settings["label"])
    ax.set_ylabel(f"{RATIO_LABEL} (median)")
    ax.set_xlabel("Home-area child poverty, quintile (1 = lowest)")
    ax.set_xticks(range(1, 6))
    fig.legend(*ax.get_legend_handles_labels(), loc="outside upper center", ncols=len(config.groups()),
               frameon=False)
    return fig


def poverty_change(table):
    """How far the 10-minute network lowers the ratio, by the child poverty of the home area."""
    fig, ax = plt.subplots(figsize=(6, 3.2), layout="constrained")
    width = 0.8 / len(config.groups())
    for offset, (group, settings) in zip(group_offsets(width), config.groups().items()):
        reduction = -compared(table, group).groupby("child_poverty_quintile")["ratio_change"].mean()
        ax.bar(reduction.index + offset, reduction, width, color=GROUP_COLORS[group],
               label=settings["label"])
    ax.set_ylabel(f"Reduction in {RATIO_LABEL}\n(mean per trip)")
    ax.set_xlabel("Home-area child poverty, quintile (1 = lowest)")
    ax.set_xticks(range(1, 6))
    fig.legend(*ax.get_legend_handles_labels(), loc="outside upper center", ncols=len(config.groups()),
               frameon=False)
    return fig


def group_offsets(width: float) -> np.ndarray:
    """Bar offsets that centre the groups side by side on each position."""
    n = len(config.groups())
    return (np.arange(n) - (n - 1) / 2) * width


def compared(table, group: str):
    """The group's trips with a car trip and a PT itinerary on both networks, so every figure
    compares the same trips."""
    mine = table[table["group"] == group]
    return mine[mine[f"ratio_{TODAY}"].notna() & mine[f"ratio_{SCENARIO}"].notna()]


def map_panels():
    groups = config.groups()
    fig, axes = plt.subplots(1, len(groups), figsize=(5 * len(groups), 4.4), layout="constrained")
    for ax, settings in zip(axes, groups.values()):
        ax.set_title(settings["label"], fontsize=10)
    return fig, axes


def draw_areas(ax, zones, values, cmap, norm, neutral=None) -> None:
    base_map(ax, zones)
    style = {"linewidth": 0, "alpha": 0.85, "zorder": 2}
    missing = values.isna()
    if neutral is not None:
        missing &= ~zones.index.isin(neutral.index)
        if not neutral.empty:
            neutral.plot(ax=ax, color=NO_CHANGE, **style)
    if missing.any():
        zones[missing].plot(ax=ax, color=NO_DATA, **style)
    if values.notna().any():
        zones[values.notna()].assign(value=values).plot(ax=ax, column="value", cmap=cmap,
                                                        norm=norm, **style)
    districts().boundary.plot(ax=ax, color=DISTRICT_EDGE, linewidth=0.5, zorder=3)
    ax.set_xlabel("")   # geopandas labels the axes with the coordinates' names
    ax.set_ylabel("")


def map_legend(colorbar, handles) -> None:
    colorbar.ax.legend(handles=handles, loc="upper left", bbox_to_anchor=(-0.4, -0.04),
                       frameon=False, fontsize=8, handlelength=1.4)


def area_key(color, label) -> Patch:
    return Patch(facecolor=color, edgecolor="0.7", linewidth=0.5, label=label)


def too_few_trips() -> str:
    return f"Fewer than {config.parameters()['min_area_trips']} trips"


def credit(fig) -> None:
    fig.text(0.01, 0.01, "Map data © OpenStreetMap contributors, Geoportal Berlin",
             fontsize=7, color=MUTED)


def shared_values(zones, column: str) -> np.ndarray:
    return zones[[f"{group}_{column}" for group in config.groups()]].to_numpy()


def has_data(values: np.ndarray) -> bool:
    return not np.isnan(values).all()


def base_map(ax, zones) -> None:
    xmin, ymin, xmax, ymax = zones.total_bounds
    pad = 0.02 * (xmax - xmin)
    ax.set_xlim(xmin - pad, xmax + pad)
    ax.set_ylim(ymin - pad, ymax + pad)
    ax.set_aspect(1 / np.cos(np.radians((ymin + ymax) / 2)))
    ax.set_facecolor(LAND)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    for highway, (width, color) in ROADS.items():
        roads()[roads()["highway"] == highway].plot(ax=ax, linewidth=width, color=color,
                                                    zorder=1)


@lru_cache(maxsize=1)
def roads() -> gpd.GeoDataFrame:
    classes = ", ".join(f"'{highway}'" for highway in ROADS)
    return gpd.read_file(config.source_path(config.load()["scenario"]["osm"]), layer="lines",
                         columns=["highway"], where=f"highway IN ({classes})")


@lru_cache(maxsize=1)
def districts() -> gpd.GeoDataFrame:
    return trips.planning_areas()[["district", "geometry"]].dissolve(by="district")
