<script>
  import { distanceBand, formats } from "../lib/text.js";
  import BandRows from "./BandRows.svelte";

  /** The walking key: the share of care trips and of commutes that are mostly walking by public
   *  transport, over every distance and in each driving-distance band; a row shows its band on the
   *  map. Within a band the two match; over every distance they don't, as care trips are shorter. */
  let { data, words, text, values } = $props();

  const GROUPS = ["care", "commute"];
  const shares = (pick) => Object.fromEntries(GROUPS.map((group) => [group, pick(group)]));
  const row = (band, label, values) => ({
    band, label, values,
    labels: Object.fromEntries(GROUPS.map((group) => [group, formats.pct(values[group])])),
  });
  const rows = $derived([
    row(null, words.all, shares((group) => values[group].walking_most)),
    ...data.summary.groups.care.by_driving_distance.map((band, i) => row(i, distanceBand(band.key, words),
      shares((group) => data.summary.groups[group].by_driving_distance[i].walking_most_share))),
  ]);
</script>

<p class="title">{@html text(words.title)}</p>
<BandRows {rows} groups={words.groups} />
<p class="unit">{@html text(words.unit)}</p>

<style>
  .title {
    margin: 0 0 8px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .unit {
    margin: 8px 0 0;
    color: var(--color-muted);
    font-size: var(--type-kicker);
  }
</style>
