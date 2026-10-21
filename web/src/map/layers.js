// The map: a muted basemap, the analysis layers drawn over it, its labels too, so names never sit
// on the data, and applyState(), which fades layers in and out and moves the camera to match a
// state from states.js. The trips (lines drawing in, dot layers recoloring) are one more layer on
// top: see overlay.js.
import * as maplibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre finds its worker from a computed URL the bundler cannot see, so hand it one.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { colors, layout, map as settings, motion, rampScale } from "../config/theme.js";

maplibre.setWorkerUrl(workerUrl);

export function createMap(container) {
  const map = new maplibre.Map({
    container,
    style: settings.basemap,
    bounds: settings.cityBounds,
    attributionControl: { compact: true },
  });
  setInteractive(map, false);
  foldCredits(map);
  // The basemap names a pattern its sprite lacks (its woods): leave it blank.
  map.setMissingStyleImageResolver((id) => {
    if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  map.on("style.load", () => {
    for (const layer of map.getStyle().layers) {
      if (layer.id.includes("poi")) map.setLayoutProperty(layer.id, "visibility", "none");
    }
    addCityLabel(map);
  });
  return map;
}

/** MapLibre's compact credits open once the basemap's arrive and fold only on the first drag,
 *  which the story's camera never makes. So they fold theme.motion.creditsMs after the map
 *  loads, as MapLibre folds them on a drag: OpenStreetMap's attribution guidelines let them
 *  fold after five seconds, behind their (i), not start folded. */
function foldCredits(map) {
  map.once("load", () => setTimeout(() => {
    map.getContainer().querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
  }, motion.creditsMs));
}

// The basemap's label for the largest cities: Berlin's, up to zoom 12, with a dot below zoom 9.
const BASEMAP_LABEL = "place_city_large";
const cityLabels = new WeakMap();   // each map's: our label's text, the basemap label's opacities

/** "Berlin" drawn by us, for a state with cityLabel (states.js); the rest show the basemap's own
 *  label. Ours is an element on the map, not a label layer: MapLibre sizes labels per tile, so
 *  their size steps as tiles load; this one's size and opacity follow the zoom smoothly. Both
 *  start hidden, until the first state picks one. */
function addCityLabel(map) {
  const element = document.createElement("div");
  element.className = "city-label";
  // The marker sets its element's opacity on every move, so the zoom's fade goes through the
  // element, and the fade between states through the text inside it.
  const text = element.appendChild(document.createElement("span"));
  text.textContent = "BERLIN";
  text.style.opacity = 0;
  const marker = new maplibre.Marker({ element }).setLngLat(settings.cityLabel.at).addTo(map);
  const resize = () => {
    const zoom = map.getZoom();
    element.style.fontSize = `${along(settings.cityLabel.size, zoom)}px`;
    marker.setOpacity(along(settings.cityLabel.opacity, zoom));
  };
  map.on("zoom", resize);
  resize();

  // The basemap's label keeps its opacities, to fade back to, and is hidden at once, not faded,
  // so it never shows before the first state. (Read from the style, so a basemap without the
  // layer only logs errors.)
  const { paint } = map.getStyle().layers.find((layer) => layer.id === BASEMAP_LABEL) ?? {};
  const basemap = {};
  for (const property of ["text-opacity", "icon-opacity"]) {
    basemap[property] = paint?.[property] ?? 1;
    map.setPaintProperty(BASEMAP_LABEL, `${property}-transition`, { duration: 0, delay: 0 });
    map.setPaintProperty(BASEMAP_LABEL, property, 0);
  }
  cityLabels.set(map, { text, basemap });
}

/** Fades our "Berlin" in and the basemap's out, or the reverse. */
function showCityLabel(map, ours) {
  const { text, basemap } = cityLabels.get(map);
  const fade = { duration: motion.fadeMs, delay: 0 };
  text.style.opacity = ours ? 1 : 0;
  for (const [property, opacity] of Object.entries(basemap)) {
    map.setPaintProperty(BASEMAP_LABEL, `${property}-transition`, fade);
    map.setPaintProperty(BASEMAP_LABEL, property, ours ? 0 : opacity);
  }
}

/** The value at `x` along [x, value] stops, linear between them and held past either end. */
export function along(stops, x) {
  const next = stops.findIndex(([at]) => at >= x);
  if (next === 0) return stops[0][1];
  if (next === -1) return stops.at(-1)[1];
  const [[x0, y0], [x1, y1]] = [stops[next - 1], stops[next]];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/** The reader can pan and zoom, never rotate or tilt (the trips are drawn in plain Web Mercator).
 *  The arrow keys move the map only in explore mode; in the story they step through it. */
export function setInteractive(map, keyboard) {
  for (const handler of ["scrollZoom", "boxZoom", "dragPan", "doubleClickZoom", "touchZoomRotate"]) {
    map[handler].enable();
  }
  map.touchZoomRotate.disableRotation();
  map.dragRotate.disable();
  map.touchPitch.disable();
  map.keyboard[keyboard ? "enable" : "disable"]();
  if (keyboard) map.keyboard.disableRotation();
}

/** Adds the analysis data as sources and layers, once the basemap has loaded. */
export function addLayers(map, data) {
  const fade = { duration: motion.fadeMs, delay: 0 };
  const add = (layer) => map.addLayer({ ...layer, paint: { ...layer.paint, ...transitions(layer, fade) } });

  map.addSource("zones", { type: "geojson", data: data.zones });
  map.addSource("districts", { type: "geojson", data: data.districts });
  map.addSource("network", { type: "geojson", data: data.network });

  add({ id: "zones", type: "fill", source: "zones",
        paint: { "fill-color": colors.noData, "fill-opacity": 0 } });
  add({ id: "zone-edges", type: "line", source: "zones",
        paint: { "line-color": colors.ground, "line-width": 0.4, "line-opacity": 0 } });
  add({ id: "coverage", type: "fill", source: "network", filter: ["==", ["get", "layer"], "coverage"],
        paint: { "fill-color": ["match", ["get", "status"], "newly_covered", colors.pt, colors.notCovered],
                 "fill-opacity": 0 } });
  add({ id: "ten-minute-lines", type: "line", source: "network",
        filter: ["==", ["get", "layer"], "ten_minute_line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.networkLines, "line-width": 3, "line-opacity": 0 } });
  add({ id: "districts", type: "line", source: "districts",
        paint: { "line-color": colors.district, "line-width": 0.8, "line-opacity": 0.6 } });
}

/** Shows a state (resolved from states.js for the reader's view): which layers are visible, how
 *  they are colored, which label names the city, and, when moveCamera, where the camera is: the
 *  whole city, or for camera "route", `route`: {points, left}, framed right of `left` px. With
 *  `steadily`, the camera flies the steady way (to step 2's trip and back): flatter than flyTo's
 *  swoop, slower, eased in and out, so it never lurches. */
export function applyState(map, state, moveCamera = true, route = null, steadily = false) {
  if (!state) return;
  const opacity = (layer, property, value) => map.setPaintProperty(layer, property, value);

  const zones = state.zones;
  if (zones) {
    map.setPaintProperty("zones", "fill-color",
      ramp(zones.property, zones.ramp));
  }
  const zoneOpacity = zones ? settings.zoneOpacity[zones.dim ? "dim" : "normal"] : 0;
  opacity("zones", "fill-opacity", zoneOpacity);
  // Edges: between colored areas in the ground's color, or gray outlines on their own.
  const outlines = !zones && state.outlines;
  map.setPaintProperty("zone-edges", "line-color", outlines ? settings.outlines.color : colors.ground);
  map.setPaintProperty("zone-edges", "line-width", outlines ? settings.outlines.width : 0.4);
  opacity("zone-edges", "line-opacity", zones ? zoneOpacity : outlines ? settings.outlines.opacity : 0);

  const lines = state.network?.lines;   // true, or an opacity to keep them behind the dots
  opacity("ten-minute-lines", "line-opacity", lines ? (typeof lines === "number" ? lines : 1) : 0);
  opacity("coverage", "fill-opacity", state.network?.coverage ? 0.45 : 0);
  showCityLabel(map, state.cityLabel);

  if (moveCamera) {
    const camera = state.camera === "route" && route ? routeCamera(map, route.points, route.left)
      : cityCamera(map);
    const flight = steadily
      ? { duration: motion.race.camera.ms, curve: motion.race.camera.curve,
          easing: (t) => (1 - Math.cos(Math.PI * t)) / 2 }
      : { duration: motion.flyMs };
    map.flyTo({ ...camera, ...flight, essential: true });
  }
}

/** The whole-city view: Berlin's center in the middle of the map's free space (right of the
 *  card; on phones, above it), zoomed past the city's edges by theme.map.cityZoomIn. */
export function cityCamera(map) {
  const { zoom, padding } = fit(map, settings.cityBounds);
  return { center: settings.cityCenter, zoom: zoom + settings.cityZoomIn, padding };
}

/** A route's view ([lon, lat] points): centered in the space right of `left` px, with
 *  theme.map.race.margin round it. */
function routeCamera(map, points, left) {
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
  const { zoom, padding } = fit(map, bounds, settings.race.margin, left);
  return { center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
           zoom: Math.min(zoom, settings.race.maxZoom), padding };
}

/** The zoom that fits `bounds` in the map's free space (or the space right of `left` px) less
 *  `margin` px all round, and that space as the camera's padding. Worked out here: MapLibre's
 *  cameraForBounds would add the map's current padding to it. */
function fit(map, [[west, south], [east, north]], margin = 0, left = null) {
  const container = map.getContainer();
  const padding = { ...freeSpace(container), ...(left == null ? {} : { left }) };
  const corner = maplibre.MercatorCoordinate.fromLngLat([west, north]);
  const opposite = maplibre.MercatorCoordinate.fromLngLat([east, south]);
  const width = container.clientWidth - padding.left - padding.right - 2 * margin;
  const height = container.clientHeight - padding.top - padding.bottom - 2 * margin;
  const scale = Math.min(width / (opposite.x - corner.x), height / (opposite.y - corner.y));
  return { zoom: Math.log2(scale / 512), padding };
}

/** The space the card takes, kept clear so the camera frames the rest. */
function freeSpace(container) {
  const { width, height } = container.getBoundingClientRect();
  if (width < layout.phoneBreakpoint) {
    return { top: 0, right: 0, left: 0, bottom: Math.round(height * (1 - settings.phoneMapShare)) };
  }
  return { top: 0, right: 0, bottom: 0, left: layout.gutter + layout.cardWidth };
}

/** The planning area under the pointer, for the tooltip: calls `show` with its properties and
 *  the pointer's place, or with null when it leaves. */
export function onZoneHover(map, show) {
  map.on("mousemove", "zones", (event) => {
    const feature = event.features?.[0];
    show(feature ? feature.properties : null, event.point);
  });
  map.on("mouseleave", "zones", () => show(null));
}

/** A choropleth's fill: the ramp's color for each area's value, noData where it has none. A
 *  neutral band's hard edges can't be interpolated, so the band is a case of its own. */
function ramp(property, name) {
  const value = ["get", property];
  const { band, middle, sides, stops } = rampScale(name);
  const scale = band
    ? ["case", ["<", ["abs", value], band], middle, ["interpolate", ["linear"], value, ...sides.flat()]]
    : ["interpolate", ["linear"], value, ...stops.flat()];
  return ["case", ["==", value, null], colors.noData, scale];
}

function transitions(layer, fade) {
  const props = { fill: ["fill-opacity"], line: ["line-opacity"], symbol: ["text-opacity"],
                  circle: ["circle-opacity", "circle-stroke-opacity"] };
  return Object.fromEntries((props[layer.type] ?? []).map((p) => [`${p}-transition`, fade]));
}
