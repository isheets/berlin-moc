// Turns the story's text into HTML: numbers from the data, numbered citations, light markdown.

/** The formats a placeholder can ask for: {care.ratio|per10}. */
export const formats = {
  int: (v) => Math.round(v).toLocaleString("en-US"),
  dec1: (v) => v.toFixed(1),
  min: (v) => String(Math.round(v)),          // minutes, whole
  pct: (v) => `${Math.round(v * 100)}%`,
  pct1: (v) => `${(v * 100).toFixed(1)}%`,
  x: (v) => `${v.toFixed(1)}×`,               // a ratio: 2.0×
  per10: (v) => String(Math.round(v * 10)),   // what 10 car minutes become
  oneIn: (v) => `1 in ${Math.round(1 / v)}`,
  inTen: (v) => `${Math.round(v * 10)} in 10`,
  text: (v) => String(v),
};

const PLACEHOLDER = /\{([\w.]+)(?:\|(\w+))?\}/g;
const CITATION = /\[cite:([\w-]+)\]/g;

/** Numbers each cited source by its first appearance in `texts`, in order. */
export function numberCitations(texts) {
  const numbers = new Map();
  for (const text of texts) {
    for (const [, id] of String(text ?? "").matchAll(CITATION)) {
      if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    }
  }
  return numbers;
}

/** Every piece of text in the story, in reading order, for numbering citations. */
export function storyTexts(story) {
  const texts = [story.intro.headline, ...story.intro.lines.map((line) => line.text)];
  for (const section of story.sections) {
    texts.push(section.title);
    for (const point of section.points) {
      texts.push(point.headline, point.text, point.footnote, ...(point.bullets ?? []));
    }
  }
  return texts;
}

/** One piece of story text as HTML, its numbers filled in from `values`. */
export function render(text, values, citations) {
  if (text == null) return "";
  let html = escape(String(text).trim());
  html = html.replace(PLACEHOLDER, (_, path, format = "text") => fill(path, format, values));
  html = html.replace(CITATION, (_, id) => {
    const n = citations.get(id);
    if (n == null) console.warn(`story: no source "${id}"`);
    return `<button type="button" class="cite" data-source="${id}" aria-label="Source ${n}">[${n ?? "?"}]</button>`;
  });
  return markdown(html);
}

function fill(path, format, values) {
  const value = path.split(".").reduce((node, key) => node?.[key], values);
  if (value == null || (typeof value === "number" && Number.isNaN(value))) {
    console.warn(`story: no value for {${path}}`);
    return "—";
  }
  const formatter = formats[format];
  if (!formatter) {
    console.warn(`story: unknown format "${format}" in {${path}|${format}}`);
    return String(value);
  }
  return formatter(value);
}

function markdown(html) {
  return html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function escape(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
