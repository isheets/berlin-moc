// Loads the analysis results (copied into public/data by scripts/copy-data.mjs) and names the
// numbers the story's text can use. To make a new number available to the copy, add it here.

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
      pt_vs_car: ptVsCar(counts.care.mode_shares),
      car_or_pt: carOrPt(counts.care),
    },
    commute: groupValues(summary.groups.commute),
    work: { share_of_trips: counts.work.share_of_trips, pt_share: counts.work.mode_shares.pt,
            pt_vs_car: ptVsCar(counts.work.mode_shares), car_or_pt: carOrPt(counts.work) },
    // What a dot stands for: trips per dot, or for a share layer, dots per km² of homes.
    dots: Object.fromEntries(Object.entries(data.dots?.layers ?? {})
      .map(([name, layer]) => [name, layer.per_dot ?? layer.per_km2])),
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

/** Of the trips by public transport or by car (as driver or passenger), the share by public
 *  transport. */
function ptVsCar(shares) {
  return shares.pt / (shares.pt + shares.car_driver + (shares.car_passenger ?? 0));
}

/** The weekday trips by public transport or by car. */
function carOrPt({ trips_per_weekday: trips, mode_shares: shares }) {
  return trips * (shares.pt + shares.car_driver + (shares.car_passenger ?? 0));
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
    saved_walk: group.change.mean_minutes_saved_per_trip_by_stage.walk,
    saved_wait: group.change.mean_minutes_saved_per_trip_by_stage.wait,
    ride_longer: -group.change.mean_minutes_saved_per_trip_by_stage.in_vehicle,
    faster: group.change.affected_share,
    saved_when_faster: group.change.median_minutes_saved_when_faster,
  };
}

/** The group's most central typical trip: the one nearest the median on every measure. */
export function centralTrip(typical, group) {
  const trips = typicalTrips(typical, group);
  const offCenter = (trip) => Math.max(...Object.values(trip.rank).map((r) => Math.abs(r - 0.5)));
  return trips.reduce((best, trip) => (best && offCenter(best) <= offCenter(trip) ? best : trip), null);
}

export function typicalTrips(typical, group) {
  return typical?.trips.filter((trip) => trip.group === group) ?? [];
}

/** The trip the reader is shown: the one picked by id, or else the most central. */
export function shownTrip(typical, group, id) {
  return (id && typical?.trips.find((trip) => trip.trip_id === id)) || centralTrip(typical, group);
}

/** A trip as a sequence of stages in time, from minute 0: what the time strips draw and the
 *  race follows. Each stage is {kind: walk, wait, ride, drive, park; start; end; leg?; line?}. */
export function timeline(trip) {
  const pt = [];
  let at = 0;
  for (const leg of trip.pt.legs) {
    if (leg.start > at + 0.01) pt.push({ kind: "wait", start: at, end: leg.start });
    pt.push({ kind: leg.mode === "walk" ? "walk" : "ride", start: leg.start, end: leg.end, leg,
              line: leg.line, mode: leg.mode });
    at = leg.end;
  }
  // The wait before setting off is shown at the stop: walk there first, then wait. The total is
  // the same; only the order changes.
  if (pt[0]?.kind === "wait" && pt[1]?.kind === "walk") {
    const walkThere = pt[1];
    const walking = walkThere.end - walkThere.start;
    pt.splice(0, 2, { ...walkThere, start: 0, end: walking },
              { kind: "wait", start: walking, end: walkThere.end });
  }
  // By car: half the walking at each end; a curbside stop or the search for parking where it
  // happens (parking is searched for at the destination).
  const { walk, stops, drive, origin_end: originEnd } = trip.car;
  const before = originEnd === "curbside" ? Math.min(stops, 1) : 0;
  const car = [];
  let t = 0;
  const add = (kind, minutes) => {
    if (minutes > 0.01) car.push({ kind, start: t, end: t + minutes });
    t += minutes;
  };
  add("walk", walk / 2);
  add("park", before);
  add("drive", drive);
  add("park", stops - before);
  add("walk", walk / 2);
  return { pt, car };
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
