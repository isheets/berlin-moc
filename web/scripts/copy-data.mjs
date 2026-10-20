// Copies the analysis results the page reads into public/data. DATA=sample reads the sample run.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const FILES = ["summary.json", "zones.geojson", "districts.geojson", "network.geojson",
  "trip-lines.json", "dots.json", "typical-trips.json"];
const results = process.env.DATA === "sample" ? "../analysis/sample/results" : "../analysis/results";
const source = new URL(`../${results}/`, import.meta.url);
const target = new URL("../public/data/", import.meta.url);

mkdirSync(target, { recursive: true });
for (const file of FILES) {
  const from = new URL(file, source);
  if (existsSync(from)) copyFileSync(from, new URL(file, target));
  else console.warn(`copy-data: ${file} is missing from ${results}`);
}
