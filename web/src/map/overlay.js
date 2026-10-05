// A canvas over the map for the trips: straight trip lines, and dot-density dots on places every
// dot layer shares (see dot_places in analysis/pipeline/layers.py). Both draw in the first time
// they appear, a planning area's worth per round, then crossfade as the state changes: lines fade,
// dots recolor in place. Also the typical trip's race, the car against the traveler.
// The map never rotates or tilts, so a point's place on screen is plain Web Mercator.
import { colors, map as settings, motion } from "../config/theme.js";
import { shownTrip, timeline } from "../lib/data.js";
import { minuteAt, playback } from "../lib/playback.svelte.js";

const TILE = 512;
const GROUPS = ["care", "commute"];

export function createOverlay(map, data) {
  const canvas = document.createElement("canvas");
  canvas.className = "map-overlay";
  Object.assign(canvas.style, { position: "absolute", inset: "0", pointerEvents: "none" });
  map.getCanvasContainer().appendChild(canvas);
  const context = canvas.getContext("2d");

  const lines = Object.fromEntries(GROUPS.map((group) => [group, lineGroup(data.tripLines, group)]));
  const dots = dotPlaces(data.dots);
  const cityZoom = map.getZoom();            // dots are sized for the whole city, and grow closer in
  let state = {};
  let frame = null;

  function resize() {
    const { clientWidth: width, clientHeight: height } = map.getContainer();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    schedule();
  }

  function schedule() {
    frame ??= requestAnimationFrame(draw);
  }

  /** Mercator [0, 1] to screen pixels, for the camera as it is now. */
  function projector() {
    const size = TILE * 2 ** map.getZoom();
    const center = map.getCenter();
    const [cx, cy] = mercator(center.lng, center.lat);
    const { clientWidth: width, clientHeight: height } = map.getContainer();
    return { size, x0: width / 2 - cx * size, y0: height / 2 - cy * size, width, height };
  }

  function draw(now) {
    frame = null;
    const view = projector();
    context.clearRect(0, 0, view.width, view.height);
    let busy = false;
    for (const group of GROUPS) busy = drawLines(lines[group], now, view) || busy;
    if (dots) busy = drawDots(now, view) || busy;
    if (state.race) busy = drawRace(now, view) || busy;
    if (state.walk === "emphasis") busy = drawWalkPulse(now, view) || busy;
    if (busy) schedule();
  }

  function drawLines(group, now, view) {
    const { from, to } = group;
    if (!from.visible && !to.visible) return false;
    const k = ease(Math.min(1, (now - group.changed) / motion.fadeMs));
    const elapsed = now - (group.drawFrom ?? now);
    const { size, x0, y0 } = view;
    context.strokeStyle = colors[group.name];
    context.lineCap = "round";
    context.lineWidth = from.width + (to.width - from.width) * k;
    let growing = false;
    for (let i = 0; i < group.count; i++) {
      const alpha = from.alpha[i] + (to.alpha[i] - from.alpha[i]) * k;
      if (alpha < 0.004) continue;
      const grow = (elapsed - group.delay[i] * group.timing.roundMs) / group.timing.growMs;
      if (grow <= 0) {
        growing = true;
        continue;
      }
      if (grow < 1) growing = true;
      const reach = ease(Math.min(1, grow));
      const x1 = x0 + group.ends[4 * i] * size;
      const y1 = y0 + group.ends[4 * i + 1] * size;
      const x2 = x0 + group.ends[4 * i + 2] * size;
      const y2 = y0 + group.ends[4 * i + 3] * size;
      context.globalAlpha = alpha;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x1 + (x2 - x1) * reach, y1 + (y2 - y1) * reach);
      context.stroke();
    }
    context.globalAlpha = 1;
    return growing || k < 1;
  }

  // Dots that keep their color are drawn once; the rest fade from the old color to the new.
  // One path per color and phase keeps tens of thousands of dots cheap to draw.
  function drawDots(now, view) {
    const { from, to } = dots;
    if (!from.visible && !to.visible) return false;
    const k = ease(Math.min(1, (now - dots.changed) / motion.fadeMs));
    const elapsed = now - (dots.drawFrom ?? now);
    const { size, x0, y0, width, height } = view;
    const radius = settings.tripLines.dots.radius * Math.max(0.6, 2 ** ((map.getZoom() - cityZoom) / 2));
    const paths = new Map();
    const add = (color, phase, x, y, r) => {
      const key = `${color}|${phase}`;
      let path = paths.get(key);
      if (!path) paths.set(key, (path = new Path2D()));
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, 2 * Math.PI);
    };
    let growing = false;
    for (let i = 0; i < dots.count; i++) {
      const a = from.color[i];
      const b = to.color[i];
      if (a < 0 && b < 0) continue;
      const grow = (elapsed - dots.delay[i] * motion.lines.dots.roundMs) / motion.lines.dots.growMs;
      if (grow <= 0) {
        growing = true;
        continue;
      }
      if (grow < 1) growing = true;
      const x = x0 + dots.xy[2 * i] * size;
      const y = y0 + dots.xy[2 * i + 1] * size;
      if (x < -radius || y < -radius || x > width + radius || y > height + radius) continue;
      const r = radius * ease(Math.min(1, grow)) * (dots.palette[b >= 0 ? b : a].ring ? 1.5 : 1);
      if (a === b) add(b, "steady", x, y, r);
      else {
        if (a >= 0) add(a, "out", x, y, r);
        if (b >= 0) add(b, "in", x, y, r);
      }
    }
    // Back to front in theme.map.dotOrder (black under blue), each color's old dots under its new.
    const opacity = settings.tripLines.dots.opacity;
    const phases = { out: 0, steady: 1, in: 2 };
    const order = ([key]) => {
      const [color, phase] = key.split("|");
      return dots.palette[color].rank * 3 + phases[phase];
    };
    for (const [key, path] of [...paths].sort((a, b) => order(a) - order(b))) {
      const [color, phase] = key.split("|");
      const { fill, ring } = dots.palette[color];
      context.globalAlpha = opacity * (phase === "steady" ? 1 : phase === "out" ? 1 - k : k);
      context.fillStyle = fill;
      context.fill(path);
      if (ring) {
        context.strokeStyle = ring;
        context.lineWidth = radius * 0.45;
        context.stroke(path);
      }
    }
    context.globalAlpha = 1;
    return growing || k < 1;
  }

  // The race: both leave at minute 0; the car's dot and the traveler's move on one clock.
  function drawRace(now, view) {
    const group = state.trip?.[0];
    const trip = shownTrip(data.typical, group, playback.selected[group]);
    if (!trip || playback.startedAt == null) return false;
    const plan = cached(trip);
    const end = trip.pt.minutes;
    const minute = minuteAt(now, end);
    const point = (lonLat) => {
      const [x, y] = mercator(...lonLat);
      return [view.x0 + x * view.size, view.y0 + y * view.size];
    };

    const car = position(plan.car, plan.carPath, minute, point);
    const traveler = position(plan.pt, null, minute, point);
    marker(car.at, colors.car, minute >= trip.car.minutes ? "Car: there" : "Car", false, now, -1);
    const waiting = traveler.stage?.kind === "wait";
    const color = { walk: colors.walk, ride: colors.pt, wait: colors.wait }[traveler.stage?.kind] ?? colors.groundText;
    marker(traveler.at, color, minute >= end ? "Public transport: there" : "Public transport",
           waiting && minute < end, now, 1);
    return minute < end || now < playback.startedAt;
  }

  /** A dot with its label above (side -1) or below (side 1), so the two never overprint. */
  function marker([x, y], color, label, pulse, now, side) {
    if (pulse) {
      const phase = (now % 900) / 900;
      context.beginPath();
      context.arc(x, y, 8 + 10 * phase, 0, 2 * Math.PI);
      context.fillStyle = color;
      context.globalAlpha = 0.35 * (1 - phase);
      context.fill();
      context.globalAlpha = 1;
    }
    context.beginPath();
    context.arc(x, y, 7, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.fill();
    context.lineWidth = 2.5;
    context.strokeStyle = colors.ground;
    context.stroke();
    context.font = `600 12px ${getComputedStyle(document.body).fontFamily}`;
    context.lineWidth = 3;
    context.strokeStyle = colors.ground;
    const ly = y + (side < 0 ? -9 : 18);
    context.strokeText(label, x + 11, ly);
    context.fillStyle = colors.groundText;
    context.fillText(label, x + 11, ly);
  }

  // The closing point: the walking legs glow in and out.
  function drawWalkPulse(now, view) {
    const trip = shownTrip(data.typical, "care", playback.selected.care);
    if (!trip) return false;
    const strength = 0.5 + 0.5 * Math.sin(now / 420);
    context.strokeStyle = colors.walk;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 10;
    context.globalAlpha = 0.12 + 0.22 * strength;
    for (const leg of trip.pt.legs.filter((leg) => leg.mode === "walk")) {
      context.beginPath();
      leg.path.forEach(([lon, lat], i) => {
        const [x, y] = mercator(lon, lat);
        context[i ? "lineTo" : "moveTo"](view.x0 + x * view.size, view.y0 + y * view.size);
      });
      context.stroke();
    }
    context.globalAlpha = 1;
    return true;
  }

  map.on("move", schedule);
  map.on("resize", resize);
  resize();

  let firstDrawn = false;
  /** The first lines to appear draw in slowly, as the opening; the rest snap in. */
  const timing = () => {
    const pace = motion.lines[firstDrawn ? "later" : "first"];
    firstDrawn = true;
    return pace;
  };

  return {
    /** Shows a state (resolved, see states.js): its lines and dots crossfade in, the race starts. */
    setState(next) {
      state = next ?? {};
      const now = performance.now();
      for (const group of GROUPS) {
        const spec = state.lines?.groups.includes(group) ? state.lines : null;
        lines[group].change(lineLook(lines[group], spec), now);
        if (spec && lines[group].drawFrom == null) {      // lines draw in the first time they show
          lines[group].drawFrom = now;
          lines[group].timing = timing();
        }
      }
      if (dots) {
        dots.change(dotLook(dots, state.dots), now);
        if (state.dots && dots.drawFrom == null) {         // and the dots, once, whichever layer
          dots.drawFrom = now;
          firstDrawn = true;
        }
      }
      schedule();
    },
    redraw: schedule,
    remove() {
      cancelAnimationFrame(frame);
      map.off("move", schedule);
      map.off("resize", resize);
      canvas.remove();
    },
  };
}

/** Something that crossfades from one look to the next. */
function fading(hidden) {
  return {
    from: hidden, to: hidden, changed: 0, drawFrom: null,
    change(look, now) {
      this.from = this.to;
      this.to = look;
      this.changed = now;
    },
  };
}

/** One group's trip lines (trip-lines.json): their ends in Mercator, when each starts to draw,
 *  and their driving-distance band. */
function lineGroup(file, name) {
  const rows = file?.[name] ?? [];
  const at = Object.fromEntries((file?.columns ?? []).map((column, i) => [column, i]));
  const ends = new Float64Array(rows.length * 4);
  const delay = new Float32Array(rows.length);
  const band = new Int8Array(rows.length);
  rows.forEach((row, i) => {
    [ends[4 * i], ends[4 * i + 1]] = mercator(row[at.origin_lon], row[at.origin_lat]);
    [ends[4 * i + 2], ends[4 * i + 3]] = mercator(row[at.destination_lon], row[at.destination_lat]);
    delay[i] = row[at.round] + jitter(i);           // within a round, areas start a little apart
    band[i] = row[at.band];
  });
  const hidden = { visible: false, alpha: new Float32Array(rows.length), width: 1 };
  return { ...fading(hidden), name, count: rows.length, ends, delay, band, timing: motion.lines.later };
}

/** How a group's lines look under a state's `lines` spec, or hidden without one. */
function lineLook(group, spec) {
  const alpha = new Float32Array(group.count);
  if (!spec) return { visible: false, alpha, width: 1 };
  const style = settings.tripLines[spec.style];
  const band = spec.only?.band;
  for (let i = 0; i < group.count; i++) {
    alpha[i] = band == null || group.band[i] === band ? style.opacity : 0;
  }
  return { visible: true, alpha, width: style.width };
}

/** The places every dot layer shares (dots.json), in Mercator, with when each draws in. */
function dotPlaces(file) {
  if (!file) return null;
  const count = file.rounds.length;
  const xy = new Float64Array(count * 2);
  const delay = new Float32Array(count);
  const [lon0, lat0] = file.origin;
  for (let i = 0; i < count; i++) {
    [xy[2 * i], xy[2 * i + 1]] = mercator(lon0 + file.places[2 * i] / file.scale,
                                          lat0 + file.places[2 * i + 1] / file.scale);
    delay[i] = file.rounds[i] + jitter(i);
  }
  // Each category's look: its fill, its ring if it has one, and its place back to front.
  const palette = [];
  const paletteIndex = (name) => {
    let at = palette.findIndex((entry) => entry.name === name);
    if (at < 0) {
      if (!colors.dots[name]) console.warn(`map: no dot color "${name}"`);
      const rank = settings.dotOrder.indexOf(name);
      at = palette.push({ name, fill: colors.dots[name], ring: colors.dotRings[name],
                          rank: rank < 0 ? settings.dotOrder.length : rank }) - 1;
    }
    return at;
  };
  return { ...fading({ visible: false, color: new Int16Array(count).fill(-1) }), count, xy, delay,
           layers: file.layers, palette, paletteIndex };
}

/** Each dot's color under a state's `dots` spec ({layer, group, recolor}), or -1 for none.
 *  recolor maps a category to another's color, e.g. every trip gray before the switch. */
function dotLook(dots, spec) {
  const color = new Int16Array(dots.count).fill(-1);
  const layer = dots.layers[spec?.layer];
  const codes = layer?.groups[spec.group];
  if (!codes) return { visible: false, color };
  const index = layer.categories.map((category) => dots.paletteIndex(spec.recolor?.[category] ?? category));
  for (let i = 0; i < dots.count; i++) {
    const code = codes.charCodeAt(i) - 48;          // "0".."9"; "." is no dot
    if (code >= 0 && code < index.length) color[i] = index[code];
  }
  return { visible: true, color };
}

/** A trip's stages and paths, worked out once. */
const plans = new WeakMap();
function cached(trip) {
  if (!plans.has(trip)) {
    const { pt, car } = timeline(trip);
    for (const stage of pt) if (stage.leg) stage.path = measured(stage.leg.path);
    plans.set(trip, { pt, car, carPath: measured(trip.car.path) });
  }
  return plans.get(trip);
}

/** Where a traveler is at `minute`: on a moving stage, that far along its path; between, at the
 *  last place reached. */
function position(stages, drivePath, minute, point) {
  let at = null;
  let current = null;
  for (const stage of stages) {
    const path = stage.path ?? (stage.kind === "drive" ? drivePath : null);
    if (minute >= stage.start && minute < stage.end) current = stage;
    if (!path) continue;
    if (minute < stage.start) {
      at ??= path.points[0];
      break;
    }
    at = along(path, (minute - stage.start) / (stage.end - stage.start));
  }
  at ??= drivePath?.points[0] ?? stages.find((stage) => stage.path)?.path.points[0];
  if (minute >= stages.at(-1).end) at = lastPoint(stages, drivePath);
  return { at: point(at), stage: current };
}

function lastPoint(stages, drivePath) {
  const moving = stages.filter((stage) => stage.path || stage.kind === "drive");
  const last = moving.at(-1);
  return (last.path ?? drivePath).points.at(-1);
}

function measured(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = mercator(...points[i - 1]);
    const [bx, by] = mercator(...points[i]);
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  return { points, lengths, total: lengths.at(-1) };
}

function along({ points, lengths, total }, share) {
  const target = Math.max(0, Math.min(1, share)) * total;
  let i = 1;
  while (i < points.length - 1 && lengths[i] < target) i++;
  const span = lengths[i] - lengths[i - 1] || 1;
  const k = Math.max(0, Math.min(1, (target - lengths[i - 1]) / span));
  const [ax, ay] = points[i - 1];
  const [bx, by] = points[i] ?? points[i - 1];
  return [ax + (bx - ax) * k, ay + (by - ay) * k];
}

function mercator(lon, lat) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return [(lon + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

function jitter(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const ease = (k) => 1 - (1 - k) ** 3;
