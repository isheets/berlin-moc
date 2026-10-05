// The map: a muted basemap, the analysis layers drawn under its labels, and applyState(), which
// fades layers in and out and moves the camera to match a state from states.js. The trips (lines
// drawing in, dot layers recoloring) are one more layer under the labels: see overlay.js.
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
  // A basemap may name a pattern its sprite lacks (the dark style's woods): leave it blank.
  map.setMissingStyleImageResolver((id) => {
    if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  map.on("style.load", () => {
    for (const layer of map.getStyle().layers) {
      if (layer.id.includes("poi")) map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });
  return map;
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

/** The basemap's first label above all its roads and fills: the analysis goes under it. */
export function firstLabel(map) {
  const basemap = map.getStyle().layers;
  const lastShape = basemap.findLastIndex((layer) => layer.type !== "symbol");
  return basemap.slice(lastShape + 1).find((layer) => layer.type === "symbol")?.id;
}

/** Adds the analysis data as sources and layers, once the basemap has loaded. */
export function addLayers(map, data) {
  const fade = { duration: motion.fadeMs, delay: 0 };
  const beforeLabels = firstLabel(map);
  const add = (layer) => map.addLayer(
    { ...layer, paint: { ...layer.paint, ...transitions(layer, fade) } }, beforeLabels);

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
 *  they are colored, and, when moveCamera, where the camera is. */
export function applyState(map, state, moveCamera = true) {
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

  if (moveCamera) map.flyTo({ ...cityCamera(map), duration: motion.flyMs, essential: true });
}

/** The whole-city view: Berlin's center in the middle of the map's free space (right of the
 *  card; on phones, above it), zoomed past the city's edges by theme.map.cityZoomIn. The fit is
 *  worked out here: MapLibre's cameraForBounds would add the map's current padding to it. */
export function cityCamera(map) {
  const container = map.getContainer();
  const padding = freeSpace(container);
  const [[west, south], [east, north]] = settings.cityBounds;
  const corner = maplibre.MercatorCoordinate.fromLngLat([west, north]);
  const opposite = maplibre.MercatorCoordinate.fromLngLat([east, south]);
  const scale = Math.min((container.clientWidth - padding.left - padding.right) / (opposite.x - corner.x),
                         (container.clientHeight - padding.top - padding.bottom) / (opposite.y - corner.y));
  return { center: settings.cityCenter, zoom: Math.log2(scale / 512) + settings.cityZoomIn, padding };
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
