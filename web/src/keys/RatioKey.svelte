<script>
  import { colors } from "../config/theme.js";
  import { explainer } from "../lib/explainer.svelte.js";
  import { formats } from "../lib/text.js";
  import Ramp from "./Ramp.svelte";

  /** The ratio key: each group's median trip city-wide, public transport against the car, large
   *  and care trips first; then which group public transport is more competitive for, area by
   *  area (commutes' median ratio minus care trips'), from care's purple on the left to commutes'
   *  green, with the city-wide gap marked, and the areas with too few trips of either. Beside the
   *  medians, the button that opens what the ratio is (`explain`, given the button), if given. */
  let { words, text, values, explain = null } = $props();

  const GROUPS = ["care", "commute"];
  const cityWide = $derived(values.commute.ratio - values.care.ratio);
</script>

<div class="medians">
  {#each GROUPS as group}
    <p><b style:color={colors[`${group}Text`]}>{formats.x(values[group].ratio)}</b>{words.groups[group]}</p>
  {/each}
  {#if explain}
    <button type="button" class="explain" aria-expanded={explainer.open}
            onclick={(event) => explain(event.currentTarget)}>
      <i aria-hidden="true">?</i>{words.explain}
    </button>
  {/if}
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
    align-items: center;
    gap: 44px;
  }

  /* What the ratio is: a step aside, as a pill tinted in the buttons' accent, so it reads as a
     button, not a median or a term; it fills on hover, like the card's other buttons. */
  .explain {
    display: flex;
    flex: none;
    align-items: center;
    gap: 7px;
    padding: 4px 13px 4px 4px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-accent) 7%, white);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
    color: var(--color-accent);
    font: inherit;
    font-size: var(--type-small);
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 150ms, background 150ms, color 150ms;
  }

  .explain:hover,
  .explain[aria-expanded="true"] {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: white;
  }

  .explain i {
    display: grid;
    flex: none;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-accent);
    color: white;
    font-style: normal;
    font-weight: 700;
    transition: background 150ms, color 150ms;
  }

  .explain:hover i,
  .explain[aria-expanded="true"] i {
    background: white;
    color: var(--color-accent);
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
