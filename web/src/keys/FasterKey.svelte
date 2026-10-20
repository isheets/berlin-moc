<script>
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import ShareKey from "./ShareKey.svelte";

  /** The 10-minute network's key: of each group's trips timed both today and with it, the share it
   *  makes faster by the minutes picked or more, overall as bars and by area on the map. The
   *  minutes are picked in the legend, from config.yaml's faster_by_min, the first by default. A
   *  share, not a count: care trips are more, so counts would show more of them sped up though the
   *  share is alike. A few areas pass the ramp's top. */
  let { words, text, values } = $props();

  const choices = $derived(Object.keys(values.care.faster_by).map(Number));
  // The trips sped up are named around the minutes picked: "Faster by {minutes} or more".
  const [before, after] = $derived(words.categories.faster.split("{minutes}"));
  const labels = $derived({ ...words.categories, faster: before + formats.minutes(view.minutes) + after });
</script>

{#snippet picker()}
  <label>{before}<span class="pick"><select bind:value={view.minutes}>
    {#each choices as minutes}<option value={minutes}>{formats.minutes(minutes)}</option>{/each}
  </select><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg></span>{after}</label>
{/snippet}

<ShareKey {words} {text} category="faster" ramp="fasterShare" orMore {labels} control={picker}
          share={(group) => values[group].faster_by[view.minutes]}
          total={(group) => values[group].paired_per_weekday} />

<style>
  /* A control inside the legend: outlined, with a chevron, unlike the names around it. */
  .pick {
    position: relative;
    display: inline-block;
    margin: 0 2px;
  }

  select {
    appearance: none;
    padding: 2px 26px 2px 8px;
    border: 1px solid var(--color-muted);
    border-radius: 6px;
    background: var(--color-card);
    color: var(--color-ink);
    font: inherit;
    cursor: pointer;
    transition: border-color 150ms, background 150ms;
  }

  select:hover {
    border-color: var(--color-ink);
    background: var(--color-paper);
  }

  /* No ring once a value is picked; from the keyboard, the hover look. */
  select:focus {
    outline: none;
  }

  select:focus-visible {
    border-color: var(--color-ink);
  }

  svg {
    position: absolute;
    top: 50%;
    right: 9px;
    width: 10px;
    height: 6px;
    margin-top: -3px;
    fill: none;
    stroke: var(--color-ink);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }
</style>
