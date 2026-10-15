// Diverging, commutes' green to care's purple through a neutral middle: which group has the
// larger share of something (two maps use it, each with its own domain).
const GAP = ["#1b7837", "#7fbf7b", "#d9f0d3", "#f2f0ec", "#e7d4e8", "#af8dc3", "#762a83"];
// On the dark map: a light neutral middle, so it stays gray beside saturated green, and each side
// from a soft but clear tint to the group's color (OKLCH, lightness falling toward the ends).
const DARK_GAP = ["#3fa52f", "#74b869", "#a1cb9a", "#d1d1d1", "#bfb4eb", "#aa97ee", "#9878f0"];

// Every color, size and speed the page uses. The CSS reads these as custom properties
// (--color-care, --card-width, ...); the map and charts read them from here. The map has a light
// and a dark version: ?map=dark swaps in DARK_MAP (a prototype, to compare the two).

export const colors = {
  paper: "#f7f6f4",          // page background, and quiet fills in the cards
  ground: "#f7f6f4",         // the map's: halos, stop circles, edges between areas
  groundText: "#1d2127",     // text and strokes drawn on the map
  card: "rgba(255, 255, 255, 0.95)",
  ink: "#1d2127",
  inkSecondary: "#4a4f57",
  muted: "#7a7e85",
  hairline: "#e3e1dc",

  accent: "#34495a",         // buttons, progress, the active section
  care: "#7a4fd0",           // the subject: care trips; told apart from commute green under CVD,
                             // and never shown beside public transport blue
  commute: "#40a02b",        // the benchmark: commutes (money)
  careText: "#7a4fd0",       // the groups' colors for text on the card, which stays light on
  commuteText: "#238700",    // either map: 4.5:1 or more on white
  pt: "#2a78d6",             // public transport
  networkLines: "#8fb2dc",   // the lines the 10-minute network adds trips to: a tint, behind dots
  car: "#2b2f36",
  walk: "#d6336c",           // the accent: walking, wherever it appears
  noData: "#a39e96",         // too few trips: a mid gray, apart from the gap ramp's pale middle
  district: "#8f8a83",
  notCovered: "#b9b4ad",

  // Ramps, light to dark. Ratio: yellow to red, as in the static figures.
  ratio: ["#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
  saved: ["#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c"],
  poverty: ["#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f"],
  gap: GAP,                  // which group the 10-minute network saves a larger share of its time
  ratioGap: GAP,             // which group public transport is more competitive for

  // The dot layers' categories (see dots.json), and the marks in the text: [mark:pt].
  dots: {
    pt: "#2a78d6", car: "#2b2f36", other: "#d6d2cb",     // trips by public transport, driving, and
                                                         // every other mode, receding
    walk_most: "#d6336c", walk_less: "#d6d2cb",          // trips walking more than half their time, or not
    care: "#7a4fd0", commute: "#40a02b",                 // trips by group, per distance band
  },

};

// The value range each ramp spans; values outside it take the end colors.
export const domains = {
  ratio: [1, 3],             // as fast as the car, to three times as long
  saved: [0, 4],             // minutes per trip
  gap: [-3, 3],              // percentage points of public transport time saved, care minus commute
  ratioGap: [-0.6, 0.6],     // commutes' median ratio minus care trips': above 0, public transport
                             // is more competitive for care trips
  poverty: [0, 50],          // % of under-15s on basic income support
};

// Diverging ramps that draw small differences around 0 in their middle color, as too small to
// call: half the band's width each side. Past it, each side's colors run out to its end, so the
// color comes in at once at the band's edge.
export const neutralBands = {
  ratioGap: 0.1,             // about half the city-wide gap, and about the noise in a typical area
};

/** A ramp's scale: its color stops, [value, color] low to high, for the legend (a neutral band's
 *  edges are hard, so a value repeats); and for the map, the band, its middle color and the stops
 *  on either side of it, which interpolate. */
export function rampScale(name) {
  const palette = colors[name];
  const [low, high] = domains[name];
  const band = neutralBands[name];
  const spread = (part, from, to) => part.map((color, i) => [from + ((to - from) * i) / (part.length - 1), color]);
  if (!band) return { stops: spread(palette, low, high) };
  const half = (palette.length - 1) / 2;
  const middle = palette[half];
  const below = spread(palette.slice(0, half), low, -band);
  const above = spread(palette.slice(half + 1), band, high);
  return { band, middle, sides: [...below, ...above],
           stops: [...below, [-band, middle], [band, middle], ...above] };
}

// How the legend labels each ramp's ends.
const points = (v) => `${v < 0 ? "−" : ""}${Math.abs(v)} pts`;
export const rampLabels = {
  ratio: (v) => `${v}×`,
  saved: (v) => `${v} min`,
  gap: points,
  ratioGap: (v) => `${v}×`,
  poverty: (v) => `${v}%`,
};

export const type = {
  family: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  body: "1.02rem",
  small: "0.85rem",
  kicker: "0.78rem",
  stepHeadline: "1.3rem",
  heroHeadline: "clamp(2rem, 4.2vw, 3.3rem)",
  lineHeight: 1.55,
};

export const layout = {
  cardWidth: 600,            // px, the story panel on desktop
  gutter: 24,                // px, between the screen edge and the panel
  phoneGutter: 12,
  phoneBreakpoint: 720,      // px; narrower screens get the phone layout
  phonePanelHeight: "56vh",   // the panel on phones; the map fills the rest
  radius: 12,
};

export const map = {
  // The whole-city view: Berlin's extent, fitted to the space beside the card, then zoomed in by
  // cityZoomIn (zoom levels) so its edges run off; its center in the middle of that space.
  cityBounds: [[13.088, 52.338], [13.761, 52.676]],
  cityCenter: [13.425, 52.507],
  cityZoomIn: 0.8,
  basemap: "https://tiles.openfreemap.org/styles/positron",
  phoneMapShare: 0.44,       // the share of a phone screen above the panel
  tripLines: {               // straight trip lines: opacity and width per style
    faint: { opacity: 0.14, width: 0.7 },
    sharp: { opacity: 0.4, width: 0.8 },
    dim: { opacity: 0.06, width: 0.7 },
    dots: { opacity: 1, radius: 1.5 },  // dot density at full strength; radius in px at the
  },                                     // whole-city view, growing as the reader zooms in
  dotScale: {},                // a category drawn larger than the rest, e.g. sparse dots over a choropleth
  // Where dense dots touch, which color lies on top: back to front.
  dotOrder: ["other", "walk_less", "car", "commute", "pt", "care", "walk_most"],
  zoneOpacity: { normal: 0.82, dim: 1 },
  outlines: { color: "#8f8a83", opacity: 0.35, width: 0.5 },   // planning areas, without a fill
};

export const motion = {
  flyMs: 1000,               // camera moves between steps
  fadeMs: 500,               // layers fading in and out
  slideMs: 320,              // a point sliding into the panel
  lines: {                   // trip lines drawing in the first time, one per planning area per round
    first: { roundMs: 200, growMs: 700 },    // the opening's care trips
    later: { roundMs: 50, growMs: 300 },     // every other set snaps in
    dots: { roundMs: 15, growMs: 150 },      // dots fill every area at once, in 20 rounds
  },
};

// The dark map: hues lifted and grays darkened to read on near-black (validated against #121212),
// and the car pale instead of black. The choropleths' sequential ramps stay the light map's.
const DARK_MAP = {
  colors: {
    ground: "#121212", groundText: "#eeeae4",
    care: "#9878f0", commute: "#3fa52f",
    pt: "#3f8fef", car: "#a4a19c", walk: "#db6ea5",
    networkLines: "#2c4466",                            // a dim blue, behind the dots
    noData: "#161618",                                  // almost black: too few trips, not "no change"
    district: "#6e6e72", notCovered: "#4a4a4c",
    gap: DARK_GAP, ratioGap: DARK_GAP,
    dots: {
      pt: "#3f8fef", car: "#a4a19c", other: "#3a3937",   // the car a soft gray, as present as
                                                         // the blue; the rest receding
      walk_most: "#db6ea5", walk_less: "#67635e",       // the rest: gray enough to count
      care: "#9878f0", commute: "#3fa52f",
    },
  },
  map: {
    basemap: "https://tiles.openfreemap.org/styles/dark",
    outlines: { color: "#a0a0a4", opacity: 0.25, width: 0.5 },
    zoneOpacity: { normal: 0.7, dim: 0.35 },
    tripLines: { faint: { opacity: 0.22, width: 0.7 } },
  },
};

/** ?map=dark: the dark map's colors in place of the light one's. */
function chooseMap() {
  if (new URLSearchParams(location.search).get("map") !== "dark") return;
  const { tripLines, ...rest } = DARK_MAP.map;
  Object.assign(colors, DARK_MAP.colors);
  Object.assign(map, rest, { tripLines: { ...map.tripLines, ...tripLines } });
}

/** Hands the tokens to CSS as custom properties on :root. */
export function applyTheme(root = document.documentElement) {
  chooseMap();
  const set = (name, value) => root.style.setProperty(name, value);
  for (const [name, value] of Object.entries(colors)) {
    if (typeof value === "string") set(`--color-${kebab(name)}`, value);
  }
  for (const [name, value] of Object.entries(type)) set(`--type-${kebab(name)}`, String(value));
  set("--card-width", `${layout.cardWidth}px`);
  set("--gutter", `${layout.gutter}px`);
  set("--phone-gutter", `${layout.phoneGutter}px`);
  set("--phone-panel-height", layout.phonePanelHeight);
  set("--radius", `${layout.radius}px`);
  set("--fade-ms", `${motion.fadeMs}ms`);

  // Components style the phone layout under html.phone, so the breakpoint lives only here.
  const phone = window.matchMedia(`(max-width: ${layout.phoneBreakpoint - 1}px)`);
  const update = () => root.classList.toggle("phone", phone.matches);
  phone.addEventListener("change", update);
  update();
}

function kebab(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
