// What the map shows, by name; story.yaml picks one per step. A state is an object, or a function
// of the reader's `view` (src/lib/view.svelte.js) for a step whose control changes the map.
//
// camera:   "city": each state frames the whole city (layers.js cityCamera)
// zones:    a choropleth of planning areas: the zones.geojson property, the theme ramp and domain
//           to color it with
// outlines: the planning areas' outlines, without a fill
// lines:    a sample of the compared trips as straight lines, on the overlay (overlay.js):
//             groups  care, commute
//             style   a key of theme.map.tripLines (opacity and width)
//             only    { band }: only the trips in that driving-distance band
// dots:     a dot layer of dots.json, on the overlay: { layer, group, recolor }, where recolor
//           gives a category another's color
// network:  the 10-minute lines: { lines: true }, or { lines: opacity } to keep them in the back

export const states = {
  hero: { camera: "city", lines: { groups: ["care"], style: "faint" } },

  modes: (view) => ({
    camera: "city",
    outlines: true,
    dots: { layer: "modes", group: view.group },
  }),

  // Which group public transport is more competitive for, by the area trips start in:
  // commutes' median ratio minus care trips'.
  ratio: {
    camera: "city",
    zones: { property: "median_ratio_gap", ramp: "ratioGap" },
  },

  // Each driving-distance band is its own group of the distance dots ("all", "0", "1", ...).
  distance: (view) => ({
    camera: "city",
    outlines: true,
    dots: { layer: "distance", group: view.band == null ? "all" : String(view.band) },
  }),

  // Each group's trips, by whether the walk to and from stops alone takes as long as the whole
  // trip by car.
  walking: (view) => ({
    camera: "city",
    outlines: true,
    dots: { layer: "walk", group: view.group },
  }),

  // The trips the 10-minute network makes a minute or more faster, of those timed both ways.
  whatif: (view) => ({
    camera: "city",
    outlines: true,
    dots: { layer: "faster", group: view.group },
  }),

  // Explore mode's layers.
  ratioCare: { camera: "city", zones: { property: "care_median_ratio_today", ramp: "ratio" } },
  ratioCommute: { camera: "city", zones: { property: "commute_median_ratio_today", ramp: "ratio" } },
  savedCare: { camera: "city", zones: { property: "care_mean_minutes_saved", ramp: "saved" } },
  savedCommute: { camera: "city", zones: { property: "commute_mean_minutes_saved", ramp: "saved" } },
  city: { camera: "city" },
};

/** The named state for the reader's view, or null. */
export function resolve(name, view) {
  const state = states[name];
  if (!state) console.warn(`map: no state "${name}"`);
  return (typeof state === "function" ? state(view) : state) ?? null;
}
