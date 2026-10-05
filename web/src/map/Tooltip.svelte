<script>
  import { formats } from "../lib/text.js";

  /** The planning area under the pointer: its name and, for the ratio map, what 10 minutes by car
   *  become by public transport. words: story.yaml's `tooltip`. */
  let { properties, point, zones, words } = $props();

  const group = $derived(zones.property.split("_")[0]);
  const share = (key) => formats.pct1(properties[key]);
  const value = $derived(properties[zones.property]);
  const trips = $derived(properties[`${group}_trips`]);
</script>

<div class="tooltip" style:left={`${point.x + 14}px`} style:top={`${point.y + 14}px`} role="status">
  <p class="name">{properties.area_name}</p>
  <p class="district">{properties.district.replace(/^\d+ - /, "")}</p>
  {#if value == null}
    <p>{words.few}</p>
  {:else if zones.ramp === "gap"}
    <p>{words.savedShare} <strong>{share("care_time_saved_share")}</strong> {words.ofCare},
      <strong>{share("commute_time_saved_share")}</strong> {words.ofCommutes}</p>
  {:else if zones.ramp === "ratio"}
    <p><strong>{words.carMinutes}</strong> {words.becomes} <strong>{formats.per10(value)} min</strong>
      {words.byPt}</p>
    <p class="note">{words.median}, {formats.int(trips)} {words.trips[group]}</p>
  {:else}
    <p><strong>{formats.dec1(value)} min</strong> {words.saved}</p>
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
