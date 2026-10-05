// The typical trip on the map and in its card: which trip each group shows, and the clock the
// race runs on. The map and the card both read the clock, so the dots and the strips agree.
import { motion } from "../config/theme.js";

export const playback = $state({
  selected: { care: null, commute: null },   // a trip_id per group; null for the most central
  startedAt: null,                           // performance.now() at minute 0; null when stopped
});

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Starts the race from minute 0, after `delay` ms (to let the camera arrive first). */
export function play(delay = 0) {
  playback.startedAt = performance.now() + (reduced() ? -1e9 : delay);
}

export function stop() {
  playback.startedAt = null;
}

/** The trip minute the race has reached at `now`, from 0 up to `end`. */
export function minuteAt(now, end) {
  if (playback.startedAt == null) return end;
  return Math.max(0, Math.min(end, (now - playback.startedAt) / motion.tripMinuteMs));
}
