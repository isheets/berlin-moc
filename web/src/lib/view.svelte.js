// What the reader has set with the step's control: the map states (states.js) and the keys
// (src/keys/) both read it. Each step starts from its own defaults (story.yaml `view`).
export const view = $state({
  group: "care",           // care or commute
  band: null,              // a driving-distance band, by index into summary's by_driving_distance
});

const DEFAULTS = $state.snapshot(view);

/** Back to the defaults, then the step's own. */
export function resetView(overrides = {}) {
  Object.assign(view, DEFAULTS, overrides);
}
