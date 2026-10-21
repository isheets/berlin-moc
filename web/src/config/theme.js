// Diverging, commutes' green to care's purple through a light neutral middle, so it stays gray
// beside saturated green, and each side from a soft but clear tint to the group's color (OKLCH,
// lightness falling toward the ends): which group public transport is more competitive for.
const GAP = ["#3fa52f", "#74b869", "#a1cb9a", "#d1d1d1", "#bfb4eb", "#aa97ee", "#9878f0"];

// Every color, size and speed the page uses. The CSS reads these as custom properties
// (--color-care, --card-width, ...); the map and charts read them from here. The map is dark: its
// hues lifted and grays darkened to read on near-black (validated against #121212), and the car
// pale instead of black. The cards stay light.

export const colors = {
  paper: "#f7f6f4",          // page background, and quiet fills in the cards
  ground: "#121212",         // the map's: halos, stop circles, edges between areas
  groundText: "#eeeae4",     // text and strokes drawn on the map
  card: "rgba(255, 255, 255, 0.95)",
  ink: "#1d2127",
  inkSecondary: "#4a4f57",
  muted: "#7a7e85",
  hairline: "#e3e1dc",

  accent: "#34495a",         // buttons, progress, the active section
  care: "#9878f0",           // the subject: care trips; told apart from commute green under CVD,
                             // and never shown beside public transport blue
  commute: "#3fa52f",        // the benchmark: commutes (money)
  careText: "#7a4fd0",       // the groups' colors for text on the card, which stays light:
  commuteText: "#238700",    // 4.5:1 or more on white
  pt: "#3f8fef",             // public transport
  networkLines: "#2c4466",   // the lines the 10-minute network adds trips to: a dim blue, behind dots
  car: "#a4a19c",
  noData: "#161618",         // too few trips: almost black, not "no change"
  district: "#6e6e72",
  notCovered: "#4a4a4c",

  // Sequential ramps, light to dark. Ratio: yellow to red, as in the static figures.
  ratio: ["#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
  saved: ["#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c"],
  poverty: ["#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f"],
  ratioGap: GAP,             // which group public transport is more competitive for
  // Shares of each area's trips, dark to bright so the most stand out on the dark map, in even
  // OKLCH steps up to the color of their bars: trips whose walk takes as long as the whole trip by
  // car, and trips the 10-minute network makes faster.
  walkShare: ["#4e2f25", "#753d2b", "#9d4b31", "#c85a36", "#f4683a"],
  fasterShare: ["#423717", "#6d5a22", "#9b802c", "#cca836", "#ffd23f"],

  // The dot layers' categories (see dots.json), and the marks in the text: [mark:pt].
  dots: {
    pt: "#3f8fef", car: "#a4a19c", other: "#3a3937",     // trips by public transport, driving (a
                                                         // soft gray, as present as the blue), and
                                                         // every other mode, receding
    walk_longer: "#f4683a", rest: "#67635e",             // trips whose walk alone outlasts the
                                                         // car, in a warning orange-red (as on the
                                                         // ratio ramp, redder is worse); the rest a
                                                         // gray that recedes but still counts
    faster: "#ffd23f",                                   // trips the 10-minute network makes a
                                                         // minute or more faster, in yellow (the
                                                         // ratio ramp's competitive end); the rest
                                                         // as above
    care: "#9878f0", commute: "#3fa52f",                 // trips by group, per distance band
  },

};

// The value range each ramp spans; values outside it take the end colors.
export const domains = {
  ratio: [1, 3],             // as fast as the car, to three times as long
  saved: [0, 4],             // minutes per trip
  ratioGap: [-0.6, 0.6],     // commutes' median ratio minus care trips': above 0, public transport
                             // is more competitive for care trips
  poverty: [0, 50],          // % of under-15s on basic income support
  walkShare: [0, 0.8],       // share of an area's trips; care trips' areas run to about 0.77
  fasterShare: [0, 0.4],     // share of an area's trips; a few areas go past it
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
export const rampLabels = {
  ratio: (v) => `${v}×`,
  saved: (v) => `${v} min`,
  ratioGap: (v) => `${v}×`,
  poverty: (v) => `${v}%`,
  walkShare: (v) => `${Math.round(v * 100)}%`,
  fasterShare: (v) => `${Math.round(v * 100)}%`,
};

export const type = {
  family: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  display: '"Charis SIL", Charis, Georgia, serif',   // headlines, and the term atop a definition
  body: "1.02rem",
  small: "0.85rem",
  kicker: "0.78rem",
  stepHeadline: "1.3rem",
  heroHeadline: "clamp(2rem, 3.6vw, 2.9rem)",
  lineHeight: 1.55,
};

export const layout = {
  cardWidth: 600,            // px, the story panel on desktop
  gutter: 24,                // px, between the screen edge and the panel
  phoneGutter: 12,
  phoneBreakpoint: 720,      // px; narrower screens get the phone layout
  phonePanelHeight: "56vh",   // the panel on phones; the map fills the rest
  radius: 12,
  waffleRows: 4,             // squares to a waffle's column
  waffleColumns: 20,         // about how many columns the fuller waffle spans: what a square
                             // stands for is picked to come closest (data.js)
  // Step 2's explainer, a drawer laid on the card (explainer.svelte.js placement): the card steps
  // back to cardBack of its size, and the drawer covers all of it but cardPeek of its width, at
  // its left, so the story reads as waiting beneath.
  cardPeek: 0.1,
  cardBack: 0.94,
  drawerWidth: 520,          // px
};

export const map = {
  // The whole-city view: Berlin's extent, fitted to the space beside the card, then zoomed in by
  // cityZoomIn (zoom levels) so its edges run off; its center in the middle of that space.
  cityBounds: [[13.088, 52.338], [13.761, 52.676]],
  cityCenter: [13.425, 52.507],
  cityZoomIn: 0.1,
  basemap: "https://tiles.openfreemap.org/styles/dark",
  phoneMapShare: 0.44,       // the share of a phone screen above the panel
  tripLines: {               // straight trip lines: opacity and width per style
    faint: { opacity: 0.22, width: 0.7 },
    sharp: { opacity: 0.4, width: 0.8 },
    dim: { opacity: 0.06, width: 0.7 },
    dots: { opacity: 0.75 },
  },
  // Dots' radius in px by zoom, [zoom, px] stops: small over the whole city, where they crowd, and
  // growing as the reader zooms in.
  dotRadius: [[9, 0.9], [10, 1.3], [11, 1.6], [12, 3], [14, 6]],
  // A category drawn larger than the rest, e.g. sparse dots over a choropleth. Step 3's care trips
  // and commutes are driven trips only, a third as many dots as step 1's.
  dotScale: { care: 1.2, commute: 1.2 },
  // Where dense dots touch, which color lies on top: back to front.
  dotOrder: ["rest", "other", "car", "commute", "pt", "care", "walk_longer", "faster"],
  zoneOpacity: { normal: 0.6, dim: 0.35 },
  outlines: { color: "#a0a0a4", opacity: 0.6, width: 1.5 },   // planning areas, without a fill
  cityLabel: {               // "Berlin", in place of the basemap's own
    at: [13.389, 52.517],                   // where OpenStreetMap places it, in Mitte
    size: [[7, 12], [10.5, 26], [14, 12]],  // [zoom, px] stops: largest over the whole city,
                                            // smaller zoomed out or in
    opacity: [[11, 1], [12.5, 0]],            // [zoom, opacity] stops: gone once zoomed in to
                                            // the neighborhoods
  },
  race: {                    // step 2's example trip (Race.svelte)
    width: { drive: 4, ride: 4, walk: 3 },  // its routes, in px
    marker: 16,            // the travelers' dots, radius in px, round their icons
    icon: 24,              // the icons, in px
    margin: 160,             // px kept clear round the routes when the camera frames them, room
                             // for the names to the left of their ends and stops
    maxZoom: 14,
  },
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
  drawer: {                  // step 2's explainer, laid on the card like a card on a stack
    ms: 500,                 // the drawer sliding on from its button, the card stepping back
    outMs: 300,              // the drawer sliding back onto its button, the card coming forward
    fadeMs: 100,             // the drawer appearing on its button; going, it fades as it moves
    ease: [0.2, 0, 0, 1],    // every move's cubic-bezier: a soft start, a long settle
    mapLagMs: 300,           // closing, the map going back only once they have moved
  },
  race: {                    // each run of the explainer's example trip
    leadMs: 400,             // before the traveler sets off
    minuteMs: 400,           // a minute of the trip
    camera: { ms: 1000, curve: 1.2 },   // the steady flight to the trip before the first run, and
                                      // back: flatter than flyTo's swoop, eased in and out
  },
  creditsMs: 5000,           // the map's credits showing before they fold behind their (i)
};

/** Hands the tokens to CSS as custom properties on :root. */
export function applyTheme(root = document.documentElement) {
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
  set("--drawer-ms", `${motion.drawer.ms}ms`);
  set("--drawer-out-ms", `${motion.drawer.outMs}ms`);
  set("--drawer-ease", `cubic-bezier(${motion.drawer.ease.join(", ")})`);

  // Components style the phone layout under html.phone, so the breakpoint lives only here.
  const phone = window.matchMedia(`(max-width: ${layout.phoneBreakpoint - 1}px)`);
  const update = () => root.classList.toggle("phone", phone.matches);
  phone.addEventListener("change", update);
  update();
}

function kebab(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
