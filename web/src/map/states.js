// What the map shows at each step, by name; story.yaml picks one per step.
//
// camera:    "city", or "trip:care" / "trip:commute" to fit that group's typical trip
// tripLines: per group, a style from theme.map.tripLines (faint, sharp, dim)
// zones:     a choropleth of planning areas: the zones.geojson property for that group, and the
//            theme ramp and domain to color it with; dim fades it behind a chart
// trip:      the typical trip(s) to draw, by group; walk: "emphasis" makes the walking legs pulse
// network:   the 10-minute lines and the coverage areas

export const states = {
  hero: { camera: "city", tripLines: { care: "faint" } },
  careLines: { camera: "city", tripLines: { care: "sharp" } },
  bothLines: { camera: "city", tripLines: { care: "sharp", commute: "sharp" } },
  linesFaint: { camera: "city", tripLines: { care: "faint", commute: "faint" } },
  tripPreview: { camera: "trip:care", tripLines: { care: "dim", commute: "dim" }, trip: ["care"] },

  ratioCare: { camera: "city", zones: { property: "care_median_ratio_today", ramp: "ratio" } },
  ratioCommute: { camera: "city", zones: { property: "commute_median_ratio_today", ramp: "ratio" } },
  chart: { camera: "city", zones: { property: "care_median_ratio_today", ramp: "ratio", dim: true } },

  tripCare: { camera: "trip:care", trip: ["care"] },
  tripCommute: { camera: "trip:commute", trip: ["commute"] },
  walkCare: { camera: "trip:care", trip: ["care"], walk: "emphasis" },

  network: { camera: "city", network: { lines: true } },
  coverage: { camera: "city", network: { lines: true, coverage: true } },
  savedCare: { camera: "city", zones: { property: "care_mean_minutes_saved", ramp: "saved" } },
  savedCommute: { camera: "city", zones: { property: "commute_mean_minutes_saved", ramp: "saved" } },

  city: { camera: "city" },
};
