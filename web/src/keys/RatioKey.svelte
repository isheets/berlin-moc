<script>
  import { colors } from "../config/theme.js";
  import Ramp from "./Ramp.svelte";

  /** The ratio key: which group public transport is more competitive for, area by area (commutes'
   *  median ratio minus care trips'), from care's purple on the left to commutes' green, with the
   *  city-wide gap marked, the areas with too few trips of either, and how many trips it rests on. */
  let { words, text, values } = $props();

  const cityWide = $derived(values.commute.ratio - values.care.ratio);
</script>

<p class="title">{@html text(words.title)}</p>
<Ramp ramp="ratioGap" ticks={[0]} center={words.even} captions={[words.careMore, words.commuteMore]} reverse
      markers={[{ value: cityWide, label: text(words.berlin), color: colors.ink, strong: true }]} />
<p class="key"><span class="swatch" style:background={colors.noData}></span>{@html text(words.noData)}</p>
<p class="simulated">{@html text(words.simulated)}</p>

<style>
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
    margin: 12px 0 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
  }

  .simulated {
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--color-hairline);
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }

  .swatch {
    width: 14px;
    height: 10px;
    border-radius: 2px;
  }
</style>
