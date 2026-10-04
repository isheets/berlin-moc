// Every color, size and speed the page uses. The CSS reads these as custom properties
// (--color-care, --card-width, ...); the map and charts read them from here.

export const colors = {
  paper: "#f7f6f4",          // page and map background
  card: "rgba(255, 255, 255, 0.95)",
  ink: "#1d2127",
  inkSecondary: "#4a4f57",
  muted: "#7a7e85",
  hairline: "#e3e1dc",

  accent: "#34495a",         // buttons, progress, the active section
  care: "#40a02b",           // the subject: care trips
  commute: "#5c6f80",        // the benchmark: commutes, a neutral slate
  pt: "#2a78d6",             // public transport
  car: "#2b2f36",
  walk: "#d6336c",           // the accent: walking, wherever it appears
  wait: "#c9c6bf",
  noData: "#dcd9d3",
  district: "#8f8a83",
  notCovered: "#b9b4ad",

  // Ramps, light to dark. Ratio: yellow to red, as in the static figures.
  ratio: ["#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
  saved: ["#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c"],
  poverty: ["#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f"],

  // Line badges, in Berlin's familiar mode colors.
  modes: { subway: "#115d91", rail: "#008d4f", tram: "#cc0a22", bus: "#a5027d", ferry: "#0080ba" },
};

// The value range each ramp spans; values outside it take the end colors.
export const domains = {
  ratio: [1.5, 2.5],
  saved: [0, 4],             // minutes per trip
  poverty: [0, 50],          // % of under-15s on basic income support
};

// How the legend labels each ramp's ends.
export const rampLabels = {
  ratio: (v) => `${v}×`,
  saved: (v) => `${v} min`,
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
  cardWidth: 440,            // px, the story panel on desktop
  gutter: 24,                // px, between the screen edge and the panel
  phoneGutter: 12,
  phoneBreakpoint: 720,      // px; narrower screens get the phone layout
  phonePanelHeight: "56vh",   // the panel on phones; the map fills the rest
  legendHeight: 168,         // px, the slot under the panel the legend sits in, on desktop
  radius: 12,
};

export const map = {
  // Berlin, with a little room around the city boundary.
  cityBounds: [[13.08, 52.33], [13.77, 52.68]],
  basemap: "https://tiles.openfreemap.org/styles/positron",
  // How much of the screen the map keeps clear for the cards.
  padding: { desktop: { top: 40, right: 60, bottom: 40 }, phone: { top: 56, right: 16, left: 16 } },
  phoneMapShare: 0.44,       // the share of a phone screen above the panel
  tripLines: {               // straight trip lines: opacity and width per style
    faint: { opacity: 0.14, width: 0.7 },
    sharp: { opacity: 0.4, width: 0.8 },
    dim: { opacity: 0.06, width: 0.7 },
  },
  zoneOpacity: { normal: 0.82, dim: 0.3 },
  routeWidth: { car: 4, ride: 3.5, walk: 3 },
};

export const motion = {
  flyMs: 1600,               // camera moves between steps
  fadeMs: 500,               // layers fading in and out
  slideMs: 320,              // a point sliding into the panel
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
  set("--legend-height", `${layout.legendHeight}px`);
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
