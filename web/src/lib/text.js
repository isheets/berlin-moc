// Turns the story's text into HTML: numbers from the data, numbered citations, terms, text in a
// group's color, color marks, light markdown.
import { colors } from "../config/theme.js";

/** The formats a placeholder can ask for: {care.ratio|per10}. */
export const formats = {
  int: (v) => Math.round(v).toLocaleString("en-US"),
  thousand: (v) => (Math.round(v / 1000) * 1000).toLocaleString("en-US"),
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

/** Splits n whole units among shares of one whole so they add up to n: each rounded down, then
 *  the largest remainders rounded up. Takes and returns an object by key. */
export function apportion(shares, n) {
  const exact = Object.entries(shares).map(([key, share]) => [key, share * n]);
  const parts = exact.map(([key, value]) => [key, Math.floor(value), value - Math.floor(value)]);
  let missing = Math.round(exact.reduce((sum, [, value]) => sum + value, 0))
    - parts.reduce((sum, [, value]) => sum + value, 0);
  for (const part of [...parts].sort((a, b) => b[2] - a[2])) {
    if (missing-- <= 0) break;
    part[1] += 1;
  }
  return Object.fromEntries(parts.map(([key, value]) => [key, value]));
}

/** Shares of one whole as whole percents that add up to 100. */
export const wholePercents = (shares) => apportion(shares, 100);

/** A driving-distance band's name: "0-4" reads "Under 4 km", "8+" reads "8 km or more", the
 *  rest "4–8 km"; words: {under, km, orMore}. */
export function distanceBand(key, words) {
  if (key.startsWith("0-")) return `${words.under} ${key.slice(2)} ${words.km}`;
  if (key.endsWith("+")) return `${key.slice(0, -1)} ${words.km} ${words.orMore}`;
  return `${key.replace("-", "–")} ${words.km}`;
}

const PLACEHOLDER = /\{([\w.]+)(?:\|(\w+))?\}/g;
const CITATION = /\[cite:([\w-]+)\]/g;
const MARK = /\[mark:(\w+)\]/g;          // [mark:pt]: a dot in the color the map gives it
const TERM = /\[([^\]]+)\]\(term:([\w-]+)\)/g;   // [care trips](term:care): a term the reader can open
const COLOR = /\[([^\]]+)\]\(color:(\w+)\)/g;      // [2.0×](color:care): text in a group's color

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

/** Every piece of text in the story, in reading order, for numbering citations: a term's
 *  definition (a text, or an object of texts) comes right after the text it first appears in. */
export function storyTexts(story) {
  const texts = [];
  const opened = new Set();
  const add = (text) => {
    if (text == null) return;
    texts.push(text);
    for (const [, , id] of String(text).matchAll(TERM)) {
      if (opened.has(id)) continue;
      opened.add(id);
      strings(story.terms?.[id]).forEach(add);
    }
  };
  const strings = (node) => (typeof node === "string" ? [node]
    : Object.values(node ?? {}).flatMap(strings));
  [story.intro.headline, story.intro.lead, ...story.intro.lines.map((line) => line.text)].forEach(add);
  for (const step of story.steps) {
    [step.headline, step.text, ...strings(story.keys?.[step.key])].forEach(add);
  }
  return texts;
}

/** One piece of story text as HTML, its numbers filled in from `values`; `terms` are the
 *  definitions a [label](term:id) can open. */
export function render(text, values, citations, terms = {}) {
  if (text == null) return "";
  let html = escape(String(text).trim());
  html = html.replace(TERM, (_, label, id) => {
    if (!terms[id]) console.warn(`story: no term "${id}"`);
    return `<button type="button" class="term" data-term="${id}" aria-expanded="false">${label}</button>`;
  });
  html = html.replace(COLOR, (_, label, name) => {
    const color = colors[`${name}Text`];
    if (!color) console.warn(`story: no text color for [...](color:${name})`);
    return `<span class="tint" style="color:${color}">${label}</span>`;
  });
  html = html.replace(PLACEHOLDER, (_, path, format = "text") => fill(path, format, values));
  html = html.replace(CITATION, (_, id) => {
    const n = citations.get(id);
    if (n == null) console.warn(`story: no source "${id}"`);
    return `<button type="button" class="cite" data-source="${id}" aria-label="Source ${n}">[${n ?? "?"}]</button>`;
  });
  html = html.replace(MARK, (_, name) => {
    const color = colors.dots[name] ?? colors[name];
    if (!color) console.warn(`story: no color for [mark:${name}]`);
    return `<i class="mark" style="background:${color}" aria-hidden="true"></i>`;
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
