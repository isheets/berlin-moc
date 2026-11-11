<script>
  import { formats } from "../lib/text.js";

  /** The planning area under the pointer: its name and what its color stands for: on the ratio
   *  map each group's median trip, on a share map the share and what it counts. words:
   *  story.yaml's `tooltip`. */
  let { properties, point, zones, words } = $props();

  const group = $derived(zones.property.split("_")[0]);
  const value = $derived(properties[zones.property]);
  // What a share map counts, with the minutes its state names, if any.
  const counts = $derived(words.shares[zones.ramp]?.replace("{minutes}", () => formats.minutes(zones.minutes)));
</script>

<div class="tooltip" style:left={`${point.x + 14}px`} style:top={`${point.y + 14}px`} role="status">
  <p class="name">{properties.area_name}</p>
  <p class="district">{properties.district.replace(/^\d+ - /, "")}</p>
  {#if value == null}
    <p>{words.few}</p>
  {:else if zones.ramp === "ratioGap"}
    <p>{words.careTrips} <strong>{formats.x(properties.care_median_ratio_today)}</strong>,
      {words.commutes} <strong>{formats.x(properties.commute_median_ratio_today)}</strong></p>
    <p class="note">{words.medianRatio}</p>
  {:else}
    <p><strong>{formats.pct(value)}</strong> {words.of} {words.trips[group]}</p>
    <p class="note">{counts}</p>
  {/if}
</div>

<style>
  .tooltip {
    position: fixed;
    z-index: 3;
    max-width: 240px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--color-card);
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.15);
    font-size: var(--type-small);
    line-height: 1.35;
    pointer-events: none;
  }

  p {
    margin: 0;
    color: var(--color-ink-secondary);
  }

  .name {
    color: var(--color-ink);
    font-weight: 600;
  }

  .district,
  .note {
    margin-bottom: 4px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
  }

  .note {
    margin: 4px 0 0;
  }

  strong {
    color: var(--color-ink);
  }
</style>
