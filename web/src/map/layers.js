// The map: a muted basemap, the analysis layers drawn under its labels, and applyState(), which
// fades layers in and out and moves the camera to match a state from states.js.
import * as maplibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre finds its worker from a computed URL the bundler cannot see, so hand it one.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { colors, domains, layout, map as settings, motion } from "../config/theme.js";
import { centralTrip } from "../lib/data.js";
import { states } from "./states.js";

const GROUPS = ["care", "commute"];

maplibre.setWorkerUrl(workerUrl);

export function createMap(container) {
  const map = new maplibre.Map({
    container,
    style: settings.basemap,
    bounds: settings.cityBounds,
    attributionControl: { compact: true },
  });
  setInteractive(map, false);
  map.on("style.load", () => {
    for (const layer of map.getStyle().layers) {
      if (layer.id.includes("poi")) map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });
  return map;
}

const HANDLERS = ["scrollZoom", "boxZoom", "dragPan", "dragRotate", "keyboard", "doubleClickZoom",
  "touchZoomRotate"];

/** The story drives the camera; explore mode hands it to the reader. */
export function setInteractive(map, on) {
  for (const handler of HANDLERS) map[handler][on ? "enable" : "disable"]();
  if (on) map.touchZoomRotate.disableRotation();
  map.dragRotate.disable();
}

/** Adds the analysis data as sources and layers, once the basemap has loaded. */
export function addLayers(map, data) {
  const fade = { duration: motion.fadeMs, delay: 0 };
  const beforeLabels = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
  const add = (layer) => map.addLayer(
    { ...layer, paint: { ...layer.paint, ...transitions(layer, fade) } }, beforeLabels);

  map.addSource("zones", { type: "geojson", data: data.zones });
  map.addSource("districts", { type: "geojson", data: data.districts });
  map.addSource("network", { type: "geojson", data: data.network });
  for (const group of GROUPS) {
    map.addSource(`lines-${group}`, { type: "geojson", data: tripLines(data.tripLines?.[group]) });
  }
  map.addSource("trips", { type: "geojson", data: typicalTrips(data.typical) });

  add({ id: "zones", type: "fill", source: "zones",
        paint: { "fill-color": colors.noData, "fill-opacity": 0 } });
  add({ id: "zone-edges", type: "line", source: "zones",
        paint: { "line-color": colors.paper, "line-width": 0.4, "line-opacity": 0 } });
  add({ id: "coverage", type: "fill", source: "network", filter: ["==", ["get", "layer"], "coverage"],
        paint: { "fill-color": ["match", ["get", "status"], "newly_covered", colors.pt, colors.notCovered],
                 "fill-opacity": 0 } });
  add({ id: "ten-minute-lines", type: "line", source: "network",
        filter: ["==", ["get", "layer"], "ten_minute_line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.pt, "line-width": 1.4, "line-opacity": 0 } });
  add({ id: "districts", type: "line", source: "districts",
        paint: { "line-color": colors.district, "line-width": 0.8, "line-opacity": 0.6 } });
  for (const group of ["commute", "care"]) {
    add({ id: `lines-${group}`, type: "line", source: `lines-${group}`,
          paint: { "line-color": colors[group], "line-width": 0.6, "line-opacity": 0 } });
  }
  add({ id: "trip-car", type: "line", source: "trips", filter: ["==", ["get", "kind"], "car"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.car, "line-width": settings.routeWidth.car, "line-opacity": 0 } });
  add({ id: "trip-ride", type: "line", source: "trips", filter: ["==", ["get", "kind"], "ride"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.pt, "line-width": settings.routeWidth.ride, "line-opacity": 0 } });
  add({ id: "trip-walk", type: "line", source: "trips", filter: ["==", ["get", "kind"], "walk"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.walk, "line-width": settings.routeWidth.walk,
                 "line-dasharray": [0.2, 1.8], "line-opacity": 0 } });
  add({ id: "trip-ends", type: "circle", source: "trips", filter: ["==", ["get", "kind"], "end"],
        paint: { "circle-radius": 5, "circle-color": colors.paper, "circle-stroke-color": colors.ink,
                 "circle-stroke-width": 2, "circle-opacity": 0, "circle-stroke-opacity": 0 } });
  // Where the trip boards, changes, and leaves public transport; changes get a ring and a name.
  add({ id: "trip-stops", type: "circle", source: "trips", filter: ["==", ["get", "kind"], "stop"],
        paint: { "circle-radius": ["match", ["get", "role"], "transfer", 7, 4.5],
                 "circle-color": colors.paper, "circle-stroke-color": colors.ink,
                 "circle-stroke-width": ["match", ["get", "role"], "transfer", 3, 2],
                 "circle-opacity": 0, "circle-stroke-opacity": 0 } });
  map.addLayer({ id: "trip-stop-labels", type: "symbol", source: "trips",
                 filter: ["==", ["get", "kind"], "stop"],
                 layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"],
                           "text-size": ["match", ["get", "role"], "transfer", 13, 11],
                           "text-anchor": "left", "text-offset": [0.9, 0], "text-max-width": 14,
                           "text-allow-overlap": true },
                 paint: { "text-color": colors.ink, "text-halo-color": colors.paper,
                          "text-halo-width": 2, "text-opacity": 0, ...transitions({ type: "symbol" }, fade) } });
  // A badge on each ride with its line, in the line's familiar color.
  add({ id: "trip-badges", type: "circle", source: "trips", filter: ["==", ["get", "kind"], "badge"],
        paint: { "circle-radius": 12, "circle-color": ["get", "color"], "circle-stroke-color": colors.paper,
                 "circle-stroke-width": 2, "circle-opacity": 0, "circle-stroke-opacity": 0 } });
  map.addLayer({ id: "trip-badge-labels", type: "symbol", source: "trips",
                 filter: ["==", ["get", "kind"], "badge"],
                 layout: { "text-field": ["get", "line"], "text-font": ["Noto Sans Bold"],
                           "text-size": 11, "text-allow-overlap": true },
                 paint: { "text-color": "#ffffff", "text-opacity": 0, ...transitions({ type: "symbol" }, fade) } });
}

// The typical trip's layers: the kind of feature each draws, and its opacity properties.
const TRIP_LAYERS = {
  "trip-car": ["car", ["line-opacity"]],
  "trip-ride": ["ride", ["line-opacity"]],
  "trip-walk": ["walk", ["line-opacity"]],
  "trip-ends": ["end", ["circle-opacity", "circle-stroke-opacity"]],
  "trip-stops": ["stop", ["circle-opacity", "circle-stroke-opacity"]],
  "trip-stop-labels": ["stop", ["text-opacity"]],
  "trip-badges": ["badge", ["circle-opacity", "circle-stroke-opacity"]],
  "trip-badge-labels": ["badge", ["text-opacity"]],
};

/** Shows the named state: which layers are visible, how they are colored, and, when moveCamera,
 *  where the camera is. */
export function applyState(map, data, name, moveCamera = true) {
  const state = states[name];
  if (!state) {
    console.warn(`map: no state "${name}"`);
    return;
  }
  const opacity = (layer, property, value) => map.setPaintProperty(layer, property, value);

  const zones = state.zones;
  if (zones) {
    map.setPaintProperty("zones", "fill-color",
      ramp(zones.property, colors[zones.ramp], domains[zones.ramp]));
  }
  const zoneOpacity = zones ? settings.zoneOpacity[zones.dim ? "dim" : "normal"] : 0;
  opacity("zones", "fill-opacity", zoneOpacity);
  opacity("zone-edges", "line-opacity", zones ? zoneOpacity : 0);

  for (const group of GROUPS) {
    const style = settings.tripLines[state.tripLines?.[group]];
    opacity(`lines-${group}`, "line-opacity", style?.opacity ?? 0);
    if (style) map.setPaintProperty(`lines-${group}`, "line-width", style.width);
  }

  const shown = state.trip ?? [];
  for (const [layer, [kind, properties]] of Object.entries(TRIP_LAYERS)) {
    map.setFilter(layer, ["all", ["==", ["get", "kind"], kind], ["in", ["get", "group"], ["literal", shown]]]);
    for (const property of properties) opacity(layer, property, shown.length ? 1 : 0);
  }
  map.setPaintProperty("trip-walk", "line-width",
    settings.routeWidth.walk * (state.walk === "emphasis" ? 1.8 : 1));

  opacity("ten-minute-lines", "line-opacity", state.network?.lines ? 0.9 : 0);
  opacity("coverage", "fill-opacity", state.network?.coverage ? 0.45 : 0);

  if (moveCamera) {
    map.fitBounds(cameraBounds(state.camera, data), {
      padding: padding(map.getContainer()), duration: motion.flyMs, essential: true,
    });
  }
}

function cameraBounds(camera, data) {
  if (camera?.startsWith("trip:")) {
    const trip = centralTrip(data.typical, camera.slice(5));
    if (trip) return bounds(tripCoordinates(trip));
  }
  return settings.cityBounds;
}

/** The space the cards take, kept clear so the camera frames the rest. */
function padding(container) {
  const { width, height } = container.getBoundingClientRect();
  if (width < layout.phoneBreakpoint) {
    return { ...settings.padding.phone, bottom: Math.round(height * (1 - settings.phoneMapShare)) };
  }
  return { ...settings.padding.desktop, left: layout.cardWidth + 2 * layout.gutter };
}

function ramp(property, palette, [low, high]) {
  const stops = palette.flatMap((color, i) => [low + ((high - low) * i) / (palette.length - 1), color]);
  return ["case", ["==", ["get", property], null], colors.noData,
    ["interpolate", ["linear"], ["get", property], ...stops]];
}

function transitions(layer, fade) {
  const props = { fill: ["fill-opacity"], line: ["line-opacity"], symbol: ["text-opacity"],
                  circle: ["circle-opacity", "circle-stroke-opacity"] };
  return Object.fromEntries((props[layer.type] ?? []).map((p) => [`${p}-transition`, fade]));
}

function tripLines(rows = []) {
  return {
    type: "FeatureCollection",
    features: rows.map(([x1, y1, x2, y2, round]) => ({
      type: "Feature", properties: { round },
      geometry: { type: "LineString", coordinates: [[x1, y1], [x2, y2]] },
    })),
  };
}

/** Each group's most central typical trip: the drive, the legs by public transport, both ends. */
function typicalTrips(typical) {
  const features = [];
  for (const group of GROUPS) {
    const trip = centralTrip(typical, group);
    if (!trip) continue;
    const line = (coordinates, properties) => features.push({
      type: "Feature", properties: { group, ...properties },
      geometry: { type: "LineString", coordinates },
    });
    line(trip.car.path, { kind: "car" });
    for (const leg of trip.pt.legs) {
      line(leg.path, { kind: leg.mode === "walk" ? "walk" : "ride", mode: leg.mode, line: leg.line });
    }
    const point = (coordinates, properties) => features.push({
      type: "Feature", properties: { group, ...properties }, geometry: { type: "Point", coordinates },
    });
    const rides = trip.pt.legs.filter((leg) => leg.mode !== "walk");
    rides.forEach((ride, i) => {
      const changing = i < rides.length - 1;
      const onto = rides[i + 1];
      point(ride.path[0], { kind: "stop", role: i === 0 ? "board" : "transfer",
                            label: i === 0 ? stopName(ride.from) : "" });
      point(ride.path.at(-1), {
        kind: "stop", role: changing ? "transfer" : "alight",
        label: changing ? `Change: ${stopName(ride.to)}${stopName(onto.from) === stopName(ride.to) ? "" : ` → ${stopName(onto.from)}`}`
                        : stopName(ride.to),
      });
      point(ride.path[Math.floor(ride.path.length / 2)],
            { kind: "badge", line: ride.line, color: badgeColor(ride) });
    });
    const coordinates = tripCoordinates(trip);
    for (const point of [coordinates[0], coordinates.at(-1)]) {
      features.push({ type: "Feature", properties: { group, kind: "end" },
                      geometry: { type: "Point", coordinates: point } });
    }
  }
  return { type: "FeatureCollection", features };
}

function stopName(name) {
  return name.replace(/\s*\(Berlin\)/, "").replace(/^Berlin, /, "");
}

/** U-Bahn, S-Bahn, tram, bus: the color Berlin knows the line by. */
function badgeColor(ride) {
  const mode = ride.mode === "rail" && /^U/.test(ride.line) ? "subway" : ride.mode;
  return colors.modes[mode] ?? colors.pt;
}

function tripCoordinates(trip) {
  return [...trip.pt.legs.flatMap((leg) => leg.path), ...trip.car.path];
}

function bounds(coordinates) {
  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}
