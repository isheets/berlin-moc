// Loads the analysis results (copied into public/data by scripts/copy-data.mjs) and names the
// numbers the story's text can use. To make a new number available to the copy, add it here.

const FILES = {
  summary: "summary.json",
  zones: "zones.geojson",
  districts: "districts.geojson",
  network: "network.geojson",
  tripLines: "trip-lines.json",
  dots: "dots.json",
};

/** Every file, or null for one that is missing (the dev server answers a missing file with the
 *  page itself, so a file that isn't JSON counts as missing). */
export async function loadData() {
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    try {
      const response = await fetch(`data/${file}`);
      if (!response.ok) throw new Error(response.statusText);
      return [key, await response.json()];
    } catch (error) {
      console.warn(`data: could not load ${file} (${error.message}); run npm run data`);
      return [key, null];
    }
  }));
  return Object.fromEntries(entries);
}

/** The values story placeholders refer to, e.g. {care.ratio} or {scenario.lines}. */
export function storyValues(data) {
  const summary = data.summary;
  const counts = summary.trip_counts.with_children;
  const coverage = summary.scenario.residents_near_a_line_every_10_minutes;
  return {
    // Each group: its trips by every mode (trip_counts: care trips and work commutes, adults
    // living with children), then its trips driven today, compared (groups).
    care: { ...tripValues(counts.care), ...groupValues(summary.groups.care) },
    commute: { ...tripValues(counts.commute), ...groupValues(summary.groups.commute) },
    trips: summary.groups.care.trips + summary.groups.commute.trips,   // timed, both groups
    minimum: summary.area_minimum_trips,          // the fewest trips an area needs, for maps
    // What a dot stands for: trips per dot, or for a share layer, dots per km² of homes.
    dots: Object.fromEntries(Object.entries(data.dots?.layers ?? {})
      .map(([name, layer]) => [name, layer.per_dot ?? layer.per_km2])),
    scenario: {
      sample: summary.scenario.sample_share,      // the share of residents the trips come from
      added_trips: summary.scenario.added_trips,
      lines: summary.scenario.lines,
      covered: coverage.today,
      covered_10: coverage.ten_minute,
    },
  };
}

/** A kind of trip by every mode: how common, how many a weekday, by which mode, and how many
 *  driven. */
function tripValues(kind) {
  const modes = modeShares(kind.mode_shares);
  return { share_of_trips: kind.share_of_trips, per_weekday: kind.trips_per_weekday, modes,
           car_trips: kind.trips_per_weekday * modes.car };
}

/** Shares of trips by public transport, driving, and every other mode (walking, cycling, riding
 *  along), as the analysis groups them for the dots (config.yaml `mode_counts.modes`). */
function modeShares(shares) {
  const car = shares.car_driver;
  return { pt: shares.pt, car, other: 1 - shares.pt - car };
}

function groupValues(group) {
  const today = group.networks.today;
  const tenMinute = group.networks.ten_minute;
  const total = (stages) => stages.walk + stages.wait + stages.in_vehicle;
  const pt = today.mean_minutes_by_stage.pt;
  const pt10 = tenMinute.mean_minutes_by_stage.pt;
  return {
    trips: group.trips,
    km: today.median_car_km,
    ratio: today.median_ratio,
    ratio_10: tenMinute.median_ratio,
    walk: pt.walk,
    pt: total(pt),
    walk_share: pt.walk / total(pt),
    walk_10: pt10.walk,
    pt_10: total(pt10),
    saved: group.change.mean_minutes_saved_per_trip,
    saved_share: group.change.share_of_time_saved,
    walking_most: today.walking_most_share,
    saved_walk: group.change.mean_minutes_saved_per_trip_by_stage.walk,
    saved_wait: group.change.mean_minutes_saved_per_trip_by_stage.wait,
    ride_longer: -group.change.mean_minutes_saved_per_trip_by_stage.in_vehicle,
    faster: group.change.affected_share,
    saved_when_faster: group.change.median_minutes_saved_when_faster,
  };
}
