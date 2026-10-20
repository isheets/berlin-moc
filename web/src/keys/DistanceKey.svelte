<script>
  import { colors } from "../config/theme.js";
  import { distanceBand, formats, wholePercents } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import BandRows from "./BandRows.svelte";
  import Ramp from "./Ramp.svelte";
  import Scale from "./Scale.svelte";

  /** The distance key: each driving-distance band's share of each group's trips, as rows that
   *  keep only that band on the map, and what a map dot stands for; under them, both groups'
   *  median ratio for the band, on the ratio ramp. */
  let { data, words, text, values } = $props();

  const GROUPS = ["care", "commute"];
  const bands = $derived(data.summary.groups.care.by_driving_distance.map((band, i) => ({
    label: distanceBand(band.key, words),
    rows: Object.fromEntries(GROUPS.map((group) => {
      const all = data.summary.groups[group].by_driving_distance;
      const total = all.reduce((sum, b) => sum + b.trips, 0);
      return [group, { share: all[i].trips / total, ratio: all[i].median_ratio_today }];
    })),
  })));
  // Each group's bands, in whole percents that add up to 100.
  const percents = $derived(Object.fromEntries(GROUPS.map((group) =>
    [group, wholePercents(Object.fromEntries(bands.map((band, i) => [i, band.rows[group].share])))])));
  const rows = $derived([
    { band: null, label: words.all, values: null },
    ...bands.map((band, i) => ({
      band: i, label: band.label,
      values: { care: band.rows.care.share, commute: band.rows.commute.share },
      labels: { care: `${percents.care[i]}%`, commute: `${percents.commute[i]}%` },
    })),
  ]);

  const lowercase = (label) => label[0].toLowerCase() + label.slice(1);   // "under 4 km", mid-sentence
  const ratio = (group) => (view.band == null ? values[group].ratio : bands[view.band].rows[group].ratio);
  const markers = $derived(GROUPS.map((group) => ({
    value: ratio(group),
    label: `${words.groups[group]} ${formats.x(ratio(group))}`,
    color: colors[`${group}Text`],
    strong: true,
  })));
</script>

{#if words.title}<p class="title">{@html text(words.title)}</p>{/if}
<BandRows {rows} groups={words.groups} />
<Scale items={[{ shape: "dot", label: text(words.dot) }]} />
<p class="title readout">{@html text(view.band == null ? words.readoutAll : words.readout)}
  {#if view.band != null}<b>{lowercase(bands[view.band].label)}</b>{/if}</p>
<Ramp ramp="ratio" {markers} ticks={[2]} orMore={false} />

<style>
  .title {
    margin: 0 0 8px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .readout {
    margin-top: 12px;
  }
</style>
