<script>
  import { colors } from "../config/theme.js";
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import Ramp from "./Ramp.svelte";

  /** The distance key: each driving-distance band as a pair of bars (each group's share of its
   *  trips), a button that keeps only that band on the map; under it, both groups' median ratio
   *  for the band, on the ratio ramp. */
  let { data, words, text, values } = $props();

  const GROUPS = ["care", "commute"];
  const bands = $derived(data.summary.groups.care.by_driving_distance.map((band, i) => ({
    key: band.key,
    rows: Object.fromEntries(GROUPS.map((group) => {
      const all = data.summary.groups[group].by_driving_distance;
      const total = all.reduce((sum, b) => sum + b.trips, 0);
      return [group, { share: all[i].trips / total, ratio: all[i].median_ratio_today }];
    })),
  })));
  const tallest = $derived(Math.max(...bands.flatMap((b) => GROUPS.map((g) => b.rows[g].share))));

  const ratio = (group) => (view.band == null ? values[group].ratio : bands[view.band].rows[group].ratio);
  const markers = $derived(GROUPS.map((group) => ({
    value: ratio(group),
    label: `${words.groups[group]} ${formats.x(ratio(group))}`,
    color: colors[group],
    strong: true,
  })));
  const pick = (i) => (view.band = view.band === i ? null : i);
</script>

<p class="title">{@html text(words.title)}</p>
<div class="bands" role="group" aria-label={words.title}>
  <button type="button" class="band all" aria-pressed={view.band == null} onclick={() => (view.band = null)}>
    <span class="bars"><span class="all-label">{words.all}</span></span>
    <span class="label">&nbsp;</span>
  </button>
  {#each bands as band, i}
    <button type="button" class="band" aria-pressed={view.band === i} onclick={() => pick(i)}
            aria-label={`${band.key} km`}>
      <span class="bars">
        {#each GROUPS as group}
          <span class="bar" style:height={`${(band.rows[group].share / tallest) * 100}%`}
                style:background={colors[group]}></span>
        {/each}
      </span>
      <span class="label">{band.key.replace("-", "–")}</span>
    </button>
  {/each}
</div>
<p class="keyline">
  {#each GROUPS as group}
    <span><i style:background={colors[group]}></i>{words.groups[group]}</span>
  {/each}
  <span class="unit">{words.km}</span>
</p>
<p class="title readout">{@html text(view.band == null ? words.readoutAll : words.readout)}
  {#if view.band != null}<b>{bands[view.band].key.replace("-", "–")} km</b>{/if}</p>
<Ramp ramp="ratio" {markers} ticks={[1.5, 2.5]} />

<style>
  .title {
    margin: 0 0 8px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .readout {
    margin-top: 14px;
  }

  .bands {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    gap: 3px;
  }

  .band {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 4px 2px 2px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    cursor: pointer;
  }

  .band:hover {
    background: var(--color-paper);
  }

  .band[aria-pressed="true"] {
    border-color: var(--color-muted);
    background: var(--color-paper);
  }

  .bars {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 2px;
    height: 56px;
  }

  .bar {
    width: 8px;
    min-height: 1px;
    border-radius: 2px 2px 0 0;
    transition: opacity 300ms;
  }

  .all-label {
    align-self: center;
    color: var(--color-ink);
    font-size: var(--type-kicker);
    font-weight: 600;
  }

  .label {
    margin-top: 3px;
    color: var(--color-muted);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
    white-space: nowrap;
  }

  .keyline {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 6px 0 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
  }

  .keyline i {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 5px;
    border-radius: 2px;
    vertical-align: -1px;
  }

  .unit {
    margin-left: auto;
    color: var(--color-muted);
  }
</style>
