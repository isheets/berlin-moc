// Step 2's example trip, by car and by public transport, each way a list of stages in trip minutes
// from its start; a stage that moves has a path (lon/lat points, measured in Web Mercator).

/** The trip's two ways as stages from minute 0, each {kind, start, end, path?, line?, to?}. By
 *  public transport: its legs, walked or ridden, and the waits between them, the wait before
 *  setting off shown at the stop (walk there first, then wait: the total is the same). By car: the
 *  walk to the car, the drive, the search for a space on arrival, and the walk to the door (the
 *  car's walking split evenly between its ends). Also each way's minutes door to door, the trip's
 *  two ends, named by their planning areas, and the stops where it boards or leaves a ride. */
export function raceOf(trip) {
  const pt = [];
  let at = 0;
  for (const leg of trip.pt.legs) {
    if (leg.start > at + 0.01) pt.push({ kind: "wait", start: at, end: leg.start });
    pt.push({ kind: leg.mode === "walk" ? "walk" : "ride", start: leg.start, end: leg.end,
              path: measured(leg.path), line: leg.line, to: stopName(leg.to) });
    at = leg.end;
  }
  if (pt[0]?.kind === "wait" && pt[1]?.kind === "walk") {
    const [, walk] = pt;
    pt.splice(0, 2, { ...walk, start: 0, end: walk.end - walk.start },
              { kind: "wait", start: walk.end - walk.start, end: walk.end });
  }

  const { walk, stops, drive, origin_end: originEnd } = trip.car;
  const before = originEnd === "curbside" ? Math.min(stops, 1) : 0;
  const car = [];
  let t = 0;
  const add = (kind, minutes, path) => {
    if (minutes > 0.01) car.push({ kind, start: t, end: t + minutes, path });
    t += minutes;
  };
  add("walk", walk / 2);
  add("park", before);
  add("drive", drive, measured(trip.car.path));
  add("park", stops - before);
  add("walk", walk / 2);

  const boardings = trip.pt.legs.filter((leg) => leg.mode !== "walk")
    .flatMap((leg) => [[stopName(leg.from), leg.path[0]], [stopName(leg.to), leg.path.at(-1)]]);
  const named = [...new Map(boardings).entries()].map(([name, point]) => ({ name, point }));
  const doors = trip.pt.legs.flatMap((leg) => leg.path);
  const ends = [{ name: trip.origin.area_name, point: doors[0] },
                { name: trip.destination.area_name, point: doors.at(-1) }];
  return { car, pt, ends, stops: named, minutes: { car: trip.car.minutes, pt: trip.pt.minutes } };
}

// "U Blissestr. (Berlin)" and "Berlin, Amtsgerichtsplatz" as the reader knows them.
const stopName = (name) => name.replace(/ \(Berlin\)$/, "").replace(/^Berlin, /, "");

/** What a way's traveler is doing at `minute`, of `end` door to door: {doing, line?, stop?}, where
 *  doing is walkToCar, drive, park, walkToStop, wait, ride, change, walkToDoor or there; line is
 *  the ride's, or the next one's while walking or waiting for it. */
export function doingAt(stages, minute, end) {
  if (minute >= end) return { doing: "there" };
  const i = Math.max(0, stages.findIndex((stage) => minute < stage.end));
  const stage = stages[i];
  const next = stages.slice(i).find((s) => s.kind === "ride");
  if (stage.kind === "drive" || stage.kind === "park") return { doing: stage.kind };
  if (stage.kind === "ride") return { doing: "ride", line: stage.line };
  if (stage.kind === "wait") return { doing: "wait", line: next?.line };
  // Walking: to the car or the first stop, on to the next ride, or to the door.
  const moving = stages.filter((s) => s.kind !== "wait");
  if (!stages.some((s) => s.kind === "ride")) {
    return { doing: stage === moving[0] ? "walkToCar" : "walkToDoor" };
  }
  if (!next) return { doing: "walkToDoor" };
  return stages.slice(0, i).some((s) => s.kind === "ride")
    ? { doing: "change", line: next.line }
    : { doing: "walkToStop", stop: stage.to };
}

/** Where a way's traveler is at `minute` ([lon, lat]), and the stage they're in, if any: along a
 *  moving stage's path, or where the last one left them. */
export function position(stages, minute) {
  const moving = stages.filter((stage) => stage.path);
  let at = moving[0].path.points[0];
  for (const stage of moving) {
    if (minute < stage.start) break;
    at = partOf(stage.path, share(stage, minute)).at(-1);
  }
  return { at, stage: stages.find((stage) => minute >= stage.start && minute < stage.end) ?? null };
}

/** The parts of a way's paths covered by `minute`: [{kind, points}]. */
export function covered(stages, minute) {
  return stages.filter((stage) => stage.path && minute > stage.start)
    .map((stage) => ({ kind: stage.kind, points: partOf(stage.path, share(stage, minute)) }));
}

/** Every point of the trip's paths, both ways: what the camera frames. */
export function routePoints(race) {
  return [...race.car, ...race.pt].flatMap((stage) => stage.path?.points ?? []);
}

const share = (stage, minute) => Math.min(1, (minute - stage.start) / (stage.end - stage.start));

/** A path's points, with the distance along it to each. */
function measured(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = mercator(...points[i - 1]);
    const [bx, by] = mercator(...points[i]);
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  return { points, lengths, total: lengths.at(-1) };
}

/** A path's points up to `part` (0 to 1) of its length, ending exactly there. */
function partOf({ points, lengths, total }, part) {
  const target = Math.max(0, Math.min(1, part)) * total;
  let i = 1;
  while (i < points.length - 1 && lengths[i] < target) i++;
  const k = Math.max(0, Math.min(1, (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)));
  const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
  return [...points.slice(0, i), [ax + (bx - ax) * k, ay + (by - ay) * k]];
}

function mercator(lon, lat) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return [(lon + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}
