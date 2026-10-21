// Step 2's explainer of public transport competitiveness (src/story/Explainer.svelte): a drawer
// laid on the card, its stages, and the runs of its example trip, which the race on the map
// (Race.svelte) follows too.
import { layout, motion } from "../config/theme.js";

export const explainer = $state({
  open: false,
  map: false,              // the map shows the trip: from the first run until a moment after it
                           // closes
  from: 0,                 // the x of the button it opened from, where the drawer slides on from
  runs: { car: null, pt: null },   // performance.now() when each way's run started
  compared: false,         // stage 3 shown
  now: 0,                  // the clock, ticked while a run moves
});

let opener = null;         // the button it opened from, which has focus again once it closes
let mapping = null;        // the map's turn, pending

/** Opens it from `button`, its stages from the start; the map stays as it was until a run. */
export function openExplainer(button) {
  opener = button;
  Object.assign(explainer, { open: true, from: button.getBoundingClientRect().left,
                             runs: { car: null, pt: null }, compared: false, now: performance.now() });
}

/** Closes it; the race on the map stays where it was while it fades out, and the map goes back
 *  a moment after the drawer, so the two don't move at once. The button gets focus once the
 *  card is no longer inert. */
export function closeExplainer() {
  if (!explainer.open) return;
  explainer.open = false;
  clearTimeout(mapping);
  mapping = setTimeout(() => (explainer.map = false), motion.drawer.mapLagMs);
  requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
}

/** Starts, or starts again, a way's run: "car" or "pt". The first sends the map to the trip,
 *  and the run waits for the flight there (motion.race.camera), its traveler at the start. */
export function run(way) {
  const flying = !explainer.map;
  clearTimeout(mapping);
  explainer.map = true;
  explainer.now = performance.now();
  explainer.runs[way] = explainer.now + (flying ? motion.race.camera.ms : 0);
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
 *  card steps back to `scale` of its size, toward its left edge and its middle, and the drawer
 *  lies on it from `left` to `right`, all of it but layout.cardPeek of its width covered. The
 *  drawer takes about the card's own place, so the map keeps the room it had. */
export function placement() {
  const { gutter, cardWidth, cardPeek, cardBack, drawerWidth } = layout;
  const left = gutter + cardWidth * cardBack * cardPeek;
  return { scale: cardBack, left, right: left + drawerWidth };
}
