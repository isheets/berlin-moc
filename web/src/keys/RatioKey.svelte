<script>
  import { colors } from "../config/theme.js";
  import { formats } from "../lib/text.js";
  import Ramp from "./Ramp.svelte";

  /** The ratio key: each group's median trip city-wide, public transport against the car, large
   *  and care trips first; then which group public transport is more competitive for, area by
   *  area (commutes' median ratio minus care trips'), from care's purple on the left to commutes'
   *  green, with the city-wide gap marked, and the areas with too few trips of either. */
  let { words, text, values } = $props();

  const GROUPS = ["care", "commute"];
  const cityWide = $derived(values.commute.ratio - values.care.ratio);
</script>

<div class="medians">
  {#each GROUPS as group}
    <p><b style:color={colors[`${group}Text`]}>{formats.x(values[group].ratio)}</b>{words.groups[group]}</p>
  {/each}
</div>
<p class="caption">{@html text(words.medians)}</p>
{#if words.title}<p class="title">{@html text(words.title)}</p>{/if}
<Ramp ramp="ratioGap" ticks={[0]} center={words.even} captions={[words.careMore, words.commuteMore]} reverse
      markers={[{ value: cityWide, label: text(words.berlin), color: colors.ink, strong: true }]} />
<p class="key"><span class="swatch" style:background={colors.noData}></span>{@html text(words.noData)}</p>

<style>
  /* The two medians side by side, each a number at display size over its group's name. */
  .medians {
    display: flex;
    gap: 44px;
  }

  .medians p {
    margin: 0;
    color: var(--color-ink);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .medians b {
    display: block;
    font-family: var(--type-display);
    font-size: 2.6rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .caption {
    margin: 4px 0 22px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
  }

  .title {
    margin: 0 0 2px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .key {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
  }

  .swatch {
    width: 16px;
    height: 12px;
    border-radius: 2px;
  }
</style>
