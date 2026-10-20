// Step 2's explainer of public transport competitiveness (src/story/Explainer.svelte): a drawer
// beside the card, its stages, and the runs of its example trip, which the race on the map
// (Race.svelte) follows too.
import { layout, motion } from "../config/theme.js";

export const explainer = $state({
  open: false,
  anchor: 0,               // the y of the button that opened it, for the drawer's caret
  runs: { car: null, pt: null },   // performance.now() when each way's run started
  compared: false,         // stage 3 shown
  now: 0,                  // the clock, ticked while a run moves
});

let opener = null;         // the button it opened from, which has focus again once it closes

/** Opens it from `button`, its stages from the start. */
export function openExplainer(button) {
  opener = button;
  const { top, height } = button.getBoundingClientRect();
  Object.assign(explainer, { open: true, anchor: top + height / 2, runs: { car: null, pt: null },
                             compared: false, now: performance.now() });
}

/** Closes it; the race on the map stays where it was while it fades out. The button gets focus
 *  once the card is no longer inert. */
export function closeExplainer() {
  if (!explainer.open) return;
  explainer.open = false;
  requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
}

/** Starts, or starts again, a way's run: "car" or "pt". */
export function run(way) {
  explainer.runs[way] = explainer.now = performance.now();
}

/** Ends a way's run now, as if it had arrived: the reader skips ahead. `end`: its minutes. */
export function finish(way, end) {
  explainer.now = performance.now();
  explainer.runs[way] = explainer.now - motion.race.leadMs - end * motion.race.minuteMs;
}

/** The trip minute a way's run has reached, of its `end` door to door: none before it starts,
 *  then one every motion.race.minuteMs after a short lead. */
export function minuteOf(way, end) {
  const startedAt = explainer.runs[way];
  if (startedAt == null) return 0;
  const { leadMs, minuteMs } = motion.race;
  return Math.max(0, Math.min(end, (explainer.now - startedAt - leadMs) / minuteMs));
}

/** Where the card and the drawer sit while it's open, in px from the screen's left edge: the
 *  card slides left by `shift`, until only layout.cardPeek of it shows, so the map keeps its
 *  room; the drawer runs from `left` to `right`. */
export function placement() {
  const { gutter, cardWidth, cardPeek, drawerWidth, drawerGap } = layout;
  const left = cardWidth * cardPeek + drawerGap;
  return { shift: gutter + cardWidth * (1 - cardPeek), left, right: left + drawerWidth };
}
