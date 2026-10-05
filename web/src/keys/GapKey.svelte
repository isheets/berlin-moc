<script>
  import { colors } from "../config/theme.js";
  import Ramp from "./Ramp.svelte";

  /** The 10-minute network's key: the share of their time it saves care trips, minus commutes',
   *  by area, on a ramp from care's purple on the left to commutes' green, and the areas with too
   *  few trips. */
  let { words, text, values } = $props();

  const gap = $derived((values.care.saved_share - values.commute.saved_share) * 100);
</script>

<p class="title">{@html text(words.title)}</p>
<Ramp ramp="gap" ticks={[0]} center={words.even} captions={[words.careMore, words.commuteMore]} reverse
      markers={[{ value: gap, label: text(words.berlin), color: colors.ink, strong: true }]} />
<ul class="keys">
  <li><i class="swatch" style:background={colors.noData}></i><span>{@html text(words.noData)}</span></li>
</ul>
<p class="compare">{@html text(words.compare)}</p>

<style>
  .title {
    margin: 0 0 2px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .keys {
    display: grid;
    gap: 6px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }

  li {
    display: grid;
    grid-template-columns: 18px 1fr;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    width: 14px;
    height: 10px;
    border-radius: 2px;
  }

  .compare {
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--color-hairline);
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }
</style>
