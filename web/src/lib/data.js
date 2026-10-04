// Loads the analysis results (copied into public/data by scripts/copy-data.mjs) and names the
// numbers the story's text can use. To make a new number available to the copy, add it here.

const FILES = {
  summary: "summary.json",
  zones: "zones.geojson",
  districts: "districts.geojson",
  network: "network.geojson",
  tripLines: "trip-lines.json",
  typical: "typical-trips.json",
};

export async function loadData() {
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    const response = await fetch(`data/${file}`);
    if (!response.ok) console.warn(`data: could not load ${file}`);
    return [key, response.ok ? await response.json() : null];
  }));
  return Object.fromEntries(entries);
}

/** The values story placeholders refer to, e.g. {care.ratio} or {typical.care.walk}. */
export function storyValues(data, activities) {
  const summary = data.summary;
  const counts = summary.trip_counts.with_children;
  const coverage = summary.scenario.residents_near_a_line_every_10_minutes;
  return {
    care: {
      ...groupValues(summary.groups.care),
      share_of_trips: counts.care.share_of_trips,
      pt_share: counts.care.mode_shares.pt,
    },
    commute: groupValues(summary.groups.commute),
    work: { share_of_trips: counts.work.share_of_trips, pt_share: counts.work.mode_shares.pt },
    scenario: {
      added_trips: summary.scenario.added_trips,
      lines: summary.scenario.lines,
      covered: coverage.today,
      covered_10: coverage.ten_minute,
    },
    typical: {
      care: typicalValues(data.typical, "care", activities),
      commute: typicalValues(data.typical, "commute", activities),
    },
  };
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
    within_1_5: today.share_by_ratio_band["up to 1.5"],
    worst: today.share_by_ratio_band["over 3.5"],
    worst_10: tenMinute.share_by_ratio_band["over 3.5"],
    walk: pt.walk,
    pt: total(pt),
    walk_share: pt.walk / total(pt),
    walk_10: pt10.walk,
    pt_10: total(pt10),
    saved: group.change.mean_minutes_saved_per_trip,
    faster: group.change.affected_share,
    saved_when_faster: group.change.median_minutes_saved_when_faster,
  };
}

/** The group's most central typical trip: the one nearest the median on every measure. */
export function centralTrip(typical, group) {
  const trips = typical?.trips.filter((trip) => trip.group === group) ?? [];
  const offCenter = (trip) => Math.max(...Object.values(trip.rank).map((r) => Math.abs(r - 0.5)));
  return trips.reduce((best, trip) => (best && offCenter(best) <= offCenter(trip) ? best : trip), null);
}

function typicalValues(typical, group, activities) {
  const trip = centralTrip(typical, group);
  if (!trip) return {};
  const end = ({ activity, area_name }) => `${activities[activity] ?? activity} at ${area_name}`;
  return {
    origin: end(trip.origin),
    destination: end(trip.destination),
    time: trip.departure_time.slice(0, 5).replace(/^0/, ""),
    car: trip.car.minutes,
    pt: trip.pt.minutes,
    walk: trip.pt.walk,
    count: typical.groups[group].typical_trips,
  };
}
