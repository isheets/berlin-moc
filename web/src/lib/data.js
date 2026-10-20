// Loads the analysis results (copied into public/data by scripts/copy-data.mjs) and names the
// numbers the story's text can use. To make a new number available to the copy, add it here.
import { layout } from "../config/theme.js";

const FILES = {
  summary: "summary.json",
  zones: "zones.geojson",
  districts: "districts.geojson",
  network: "network.geojson",
  tripLines: "trip-lines.json",
  dots: "dots.json",
  typical: "typical-trips.json",
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
  // Each group: its trips by every mode (trip_counts: care trips and work commutes, adults
  // living with children), then its trips driven today, compared (groups).
  const care = { ...tripValues(counts.care), ...groupValues(summary.groups.care, summary.scenario.sample_share) };
  const commute = { ...tripValues(counts.commute), ...groupValues(summary.groups.commute, summary.scenario.sample_share) };
  return {
    care,
    commute,
    trips: summary.groups.care.trips + summary.groups.commute.trips,   // timed, both groups
    minimum: summary.area_minimum_trips,          // the fewest trips of a group an area needs, for any map
    // What a dot stands for: trips per dot, or for a share layer, dots per km² of homes.
    dots: Object.fromEntries(Object.entries(data.dots?.layers ?? {})
      .map(([name, layer]) => [name, layer.per_dot ?? layer.per_km2])),
    // What a waffle square stands for, in trips a weekday: trips by every mode (step 1).
    squares: { modes: perSquare([care.per_weekday, commute.per_weekday]) },
    example: exampleValues(exampleTrip(data.typical)),
    scenario: {
      sample: summary.scenario.sample_share,      // the share of residents the trips come from
      added_trips: summary.scenario.added_trips,
      lines: summary.scenario.lines,
      covered: coverage.today,
      covered_10: coverage.ten_minute,
    },
  };
}

/** Step 2's example trip, which races the car against public transport: the care trip nearest
 *  the median on every measure the typical trips are picked by (typical-trips.json: driving
 *  distance, public transport vs. car time, and walking's share of that time). */
export function exampleTrip(typical) {
  const trips = typical?.trips.filter((trip) => trip.group === "care") ?? [];
  const offCenter = (trip) => Math.max(...Object.values(trip.rank).map((rank) => Math.abs(rank - 0.5)));
  return trips.reduce((best, trip) => (best && offCenter(best) <= offCenter(trip) ? best : trip), null);
}

/** The example trip's ends (planning areas), when it leaves, and its minutes door to door, both
 *  ways. */
function exampleValues(trip) {
  if (!trip) return {};
  return { from: trip.origin.area_name, to: trip.destination.area_name,
           departure: trip.departure_time, car: trip.car.minutes, pt: trip.pt.minutes,
           ratio: trip.ratio.today };
}

/** What a waffle square stands for: the round number of trips (1, 2, 2.5 or 5 × 10ⁿ) that makes
 *  the largest of `totals` come closest to layout.waffleColumns columns of layout.waffleRows. */
function perSquare(totals) {
  const largest = Math.max(...totals);
  const columns = (per) => Math.ceil(Math.round(largest / per) / layout.waffleRows);
  const scale = 10 ** Math.floor(Math.log10(largest / (layout.waffleRows * layout.waffleColumns)));
  const off = (per) => Math.abs(columns(per) - layout.waffleColumns);
  return [1, 2, 2.5, 5, 10].map((step) => step * scale).reduce((best, per) => (off(per) < off(best) ? per : best));
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

function groupValues(group, sample) {
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
    walking_most: today.walking_most_share,
    walk_alone: today.walk_alone_share,           // the walk alone as long as the car trip, or longer
    routed_per_weekday: today.compared_trips / sample,   // trips with a public transport route
    saved_walk: group.change.mean_minutes_saved_per_trip_by_stage.walk,
    saved_wait: group.change.mean_minutes_saved_per_trip_by_stage.wait,
    ride_longer: -group.change.mean_minutes_saved_per_trip_by_stage.in_vehicle,
    faster: group.change.faster_trips / group.change.paired_trips,   // a minute or more faster
                                                                     // with the 10-minute network
    // The same share for each of the step's choices, faster by that many minutes or more.
    faster_by: Object.fromEntries(Object.entries(group.change.faster_trips_by_min)
      .map(([minutes, trips]) => [minutes, trips / group.change.paired_trips])),
    paired_per_weekday: group.change.paired_trips / sample,          // trips timed today and with it
    saved_when_faster: group.change.median_minutes_saved_when_faster,
  };
}
