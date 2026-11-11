// The trips, drawn inside the map as one WebGL layer over the basemap, labels and all: straight trip
// lines, and dots on places every dot layer shares (see dot_places in
// analysis/pipeline/layers.py). Both draw in the first time they appear, a planning area's worth
// per round, then crossfade as the state changes: lines fade, dots recolor in place.
// The map never rotates or tilts, so positions are plain Web Mercator.
import { colors, map as settings, motion } from "../config/theme.js";
import { along } from "./layers.js";

const GROUPS = ["care", "commute"];
const ORIGIN = mercator(13.4, 52.5);   // vertices are kept relative to Berlin, for precision
const DOT_FLOATS = 7;                  // x, y, radius, rgba
const LINE_FLOATS = 6;                 // x, y, rgba, per end

const DOT_VERTEX = `#version 300 es
uniform mat4 u_matrix;
uniform float u_pixel_ratio;
in vec2 a_pos;
in float a_radius;
in vec4 a_color;
out vec4 v_color;
out float v_radius;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_radius = a_radius * u_pixel_ratio;
  gl_PointSize = 2.0 * v_radius + 2.0;
  v_color = a_color;
}`;

// A round dot with a soft edge.
const DOT_FRAGMENT = `#version 300 es
precision mediump float;
in vec4 v_color;
in float v_radius;
out vec4 fragment;
void main() {
  float d = length(gl_PointCoord - 0.5) * (2.0 * v_radius + 2.0);
  float alpha = v_color.a * clamp(v_radius - d + 0.5, 0.0, 1.0);
  fragment = vec4(v_color.rgb * alpha, alpha);
}`;

const LINE_VERTEX = `#version 300 es
uniform mat4 u_matrix;
in vec2 a_pos;
in vec4 a_color;
out vec4 v_color;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_color = a_color;
}`;

const LINE_FRAGMENT = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 fragment;
void main() {
  fragment = vec4(v_color.rgb * v_color.a, v_color.a);
}`;

/** Adds the trips layer to the map, on top. */
export function createOverlay(map, data) {
  const lines = Object.fromEntries(GROUPS.map((group) => [group, lineGroup(data.tripLines, group)]));
  const dots = dotPlaces(data.dots);
  let firstDrawn = false;
  let programs = null;
  let built = { lines: new Float32Array(0), dots: new Float32Array(0) };
  let moving = true;                         // something is still drawing in or crossfading

  /** Every visible line's and dot's vertices as they look at `now`; whether any still move. */
  function build(now) {
    const lineData = [];
    let busy = false;
    for (const group of GROUPS) busy = buildLines(lines[group], now, lineData) || busy;
    const dotData = dots ? buildDots(now) : { data: new Float32Array(0), busy: false };
    built = { lines: new Float32Array(lineData), dots: dotData.data };
    return busy || dotData.busy;
  }

  function buildLines(group, now, out) {
    const { from, to } = group;
    if (!from.visible && !to.visible) return false;
    const k = ease(Math.min(1, (now - group.changed) / motion.fadeMs));
    const elapsed = now - (group.drawFrom ?? now);
    const [r, g, b] = rgb(colors[group.name]);
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
      const [x1, y1, x2, y2] = group.ends.subarray(4 * i, 4 * i + 4);
      out.push(x1, y1, r, g, b, alpha, x1 + (x2 - x1) * reach, y1 + (y2 - y1) * reach, r, g, b, alpha);
    }
    return growing || k < 1;
  }

  // Dots that keep their color are drawn once; the rest fade from the old color to the new. They
  // go back to front in theme.map.dotOrder (black under blue), each color's old dots under its new.
  function buildDots(now) {
    const { from, to } = dots;
    if (!from.visible && !to.visible) return { data: new Float32Array(0), busy: false };
    const k = ease(Math.min(1, (now - dots.changed) / motion.fadeMs));
    const elapsed = now - (dots.drawFrom ?? now);
    // Small over the whole city, growing as the reader zooms in.
    const radius = along(settings.dotRadius, map.getZoom());
    const opacity = settings.tripLines.dots.opacity;
    const buckets = [];                               // by color rank, then out / steady / in
    const put = (i, color, phase, alpha, size) =>
      (buckets[dots.palette[color].rank * 3 + phase] ??= []).push(i, color, alpha * opacity, size);
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
      const size = ease(Math.min(1, grow));
      if (a === b) put(i, b, 1, 1, size);
      else {
        if (a >= 0) put(i, a, 0, 1 - k, size);
        if (b >= 0) put(i, b, 2, k, size);
      }
    }
    const count = buckets.reduce((sum, bucket) => sum + (bucket ? bucket.length / 4 : 0), 0);
    const out = new Float32Array(count * DOT_FLOATS);
    let o = 0;
    for (const bucket of buckets) {
      if (!bucket) continue;
      for (let j = 0; j < bucket.length; j += 4) {
        const i = bucket[j];
        const { fill, scale } = dots.palette[bucket[j + 1]];
        out[o] = dots.xy[2 * i];
        out[o + 1] = dots.xy[2 * i + 1];
        out[o + 2] = radius * bucket[j + 3] * scale;
        out.set(fill, o + 3);
        out[o + 6] = bucket[j + 2];
        o += DOT_FLOATS;
      }
    }
    return { data: out, busy: growing || k < 1 };
  }

  const layer = {
    id: "trips",
    type: "custom",
    renderingMode: "2d",
    onAdd(_, gl) {
      programs = {
        dots: program(gl, DOT_VERTEX, DOT_FRAGMENT, [["a_pos", 2], ["a_radius", 1], ["a_color", 4]]),
        lines: program(gl, LINE_VERTEX, LINE_FRAGMENT, [["a_pos", 2], ["a_color", 4]]),
      };
    },
    render(gl, options) {
      // While anything moves, and whenever dots show (their size follows the zoom), rebuild.
      if (moving || dots?.to.visible) moving = build(performance.now());
      const matrix = translated(options.defaultProjectionData.mainMatrix, ORIGIN);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      draw(gl, programs.lines, built.lines, matrix, gl.LINES);
      draw(gl, programs.dots, built.dots, matrix, gl.POINTS, { u_pixel_ratio: window.devicePixelRatio || 1 });
      if (moving) map.triggerRepaint();
    },
    onRemove(_, gl) {
      for (const p of Object.values(programs ?? {})) {
        gl.deleteBuffer(p.buffer);
        gl.deleteProgram(p.program);
      }
    },
  };
  map.addLayer(layer);

  /** The first lines to appear draw in slowly, as the opening; the rest snap in. */
  const timing = () => {
    const pace = motion.lines[firstDrawn ? "later" : "first"];
    firstDrawn = true;
    return pace;
  };

  return {
    /** Shows a state (resolved, see states.js): its lines and dots crossfade in. */
    setState(state) {
      const now = performance.now();
      for (const group of GROUPS) {
        const spec = state?.lines?.groups.includes(group) ? state.lines : null;
        lines[group].change(lineLook(lines[group], spec), now);
        if (spec && lines[group].drawFrom == null) {      // lines draw in the first time they show
          lines[group].drawFrom = now;
          lines[group].timing = timing();
        }
      }
      if (dots) {
        dots.change(dotLook(dots, state?.dots), now);
        if (state?.dots && dots.drawFrom == null) {        // and the dots, once, whichever layer
          dots.drawFrom = now;
          firstDrawn = true;
        }
      }
      moving = true;
      map.triggerRepaint();
    },
    remove() {
      if (map.getLayer("trips")) map.removeLayer("trips");
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
  const ends = new Float32Array(rows.length * 4);
  const delay = new Float32Array(rows.length);
  const band = new Int8Array(rows.length);
  rows.forEach((row, i) => {
    ends.set([...relative(row[at.origin_lon], row[at.origin_lat]),
              ...relative(row[at.destination_lon], row[at.destination_lat])], 4 * i);
    delay[i] = row[at.round] + jitter(i);           // within a round, areas start a little apart
    band[i] = row[at.band];
  });
  const hidden = { visible: false, alpha: new Float32Array(rows.length) };
  return { ...fading(hidden), name, count: rows.length, ends, delay, band, timing: motion.lines.later };
}

/** How a group's lines look under a state's `lines` spec, or hidden without one. */
function lineLook(group, spec) {
  const alpha = new Float32Array(group.count);
  if (!spec) return { visible: false, alpha };
  const style = settings.tripLines[spec.style];
  const band = spec.only?.band;
  for (let i = 0; i < group.count; i++) {
    alpha[i] = band == null || group.band[i] === band ? style.opacity : 0;
  }
  return { visible: true, alpha };
}

/** The places every dot layer shares (dots.json), in Mercator, with when each draws in. */
function dotPlaces(file) {
  if (!file) return null;
  const count = file.rounds.length;
  const xy = new Float32Array(count * 2);
  const delay = new Float32Array(count);
  const [lon0, lat0] = file.origin;
  for (let i = 0; i < count; i++) {
    xy.set(relative(lon0 + file.places[2 * i] / file.scale, lat0 + file.places[2 * i + 1] / file.scale), 2 * i);
    delay[i] = file.rounds[i] + jitter(i);
  }
  // Each category's look: its fill, its size (theme.map.dotScale), and its place back to front.
  const palette = [];
  const paletteIndex = (name) => {
    let at = palette.findIndex((entry) => entry.name === name);
    if (at < 0) {
      if (!colors.dots[name]) console.warn(`map: no dot color "${name}"`);
      const rank = settings.dotOrder.indexOf(name);
      at = palette.push({ name, fill: rgb(colors.dots[name]), scale: settings.dotScale[name] ?? 1,
                          rank: rank < 0 ? settings.dotOrder.length : rank }) - 1;
    }
    return at;
  };
  return { ...fading({ visible: false, color: new Int16Array(count).fill(-1) }), count, xy, delay,
           layers: file.layers, palette, paletteIndex };
}

/** Each dot's color under a state's `dots` spec ({layer, group, recolor}), or -1 for none.
 *  recolor maps a category to another's color. */
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

// WebGL plumbing: a program with its interleaved layout ([[attribute, size], ...]) and buffer.

function program(gl, vertex, fragment, layout) {
  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return {
    program: p,
    buffer: gl.createBuffer(),
    layout: layout.map(([name, size]) => [gl.getAttribLocation(p, name), size]),
    stride: layout.reduce((sum, [, size]) => sum + size, 0),
    uniforms: {},
  };
}

/** Uploads interleaved floats and draws them. */
function draw(gl, p, data, matrix, mode, uniforms = {}) {
  const count = data.length / p.stride;
  if (!count) return;
  gl.useProgram(p.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  let offset = 0;
  for (const [at, size] of p.layout) {
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, size, gl.FLOAT, false, p.stride * 4, offset);
    offset += size * 4;
  }
  const uniform = (name) => (p.uniforms[name] ??= gl.getUniformLocation(p.program, name));
  gl.uniformMatrix4fv(uniform("u_matrix"), false, matrix);
  for (const [name, value] of Object.entries(uniforms)) gl.uniform1f(uniform(name), value);
  gl.drawArrays(mode, 0, count);
  for (const [at] of p.layout) gl.disableVertexAttribArray(at);
}

/** The map's matrix, moved so vertices can be given relative to ORIGIN. */
function translated(m, [ox, oy]) {
  const out = Float32Array.from(m);
  for (let i = 0; i < 4; i++) out[12 + i] = m[i] * ox + m[4 + i] * oy + m[12 + i];
  return out;
}

function relative(lon, lat) {
  const [x, y] = mercator(lon, lat);
  return [x - ORIGIN[0], y - ORIGIN[1]];
}

function mercator(lon, lat) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return [(lon + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function jitter(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const ease = (k) => 1 - (1 - k) ** 3;
