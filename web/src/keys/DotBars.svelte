<script>
  import { colors } from "../config/theme.js";
  import { formats } from "../lib/text.js";

  /** A dot layer's key: a bar per group, split by category in the dots' colors, each a button
   *  that shows its group on the map. The categories are named just above the first bar, over
   *  their own segments, so no separate color legend is needed; what a dot stands for goes under.
   *  rows: [{key, label, sub, shares: {category: share}}]; categories: [{key, label}].
   *  keyBelow: name the categories in a row under the bars instead, for slivers too thin to
   *  label over. */
  let { rows, categories, selected, select, unit, keyBelow = false } = $props();

  const first = $derived(rows[0].shares);
  // Dark text on light segments, white on the rest.
  const light = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
  };
  // The first name sits at its segment's start, the last at its end, the rest centered.
  const anchor = (i) => (i === 0 ? "start" : i === categories.length - 1 ? "end" : "middle");
  const place = (i) => {
    const before = categories.slice(0, i).reduce((sum, c) => sum + first[c.key], 0);
    const at = { start: before, middle: before + first[categories[i].key] / 2,
                 end: before + first[categories[i].key] }[anchor(i)];
    return `${at * 100}%`;
  };
</script>

<div class="bars">
  {#if !keyBelow}
    <div class="names" aria-hidden="true">
      {#each categories as category, i}
        <span class={anchor(i)} style:left={place(i)}>
          <i style:background={colors.dots[category.key]}></i>{category.label}
        </span>
      {/each}
    </div>
  {/if}
  {#each rows as row}
    <button type="button" class="row" aria-pressed={selected === row.key} onclick={() => select(row.key)}>
      <span class="label">{row.label}{#if row.sub}<small>{row.sub}</small>{/if}</span>
      <span class="bar">
        {#each categories as category}
          <span class="segment" style:flex={row.shares[category.key]}
                style:background={colors.dots[category.key]}
                title={`${category.label}: ${formats.pct(row.shares[category.key])}`}>
            {#if row.shares[category.key] >= 0.12}
              <b style:color={light(colors.dots[category.key]) ? colors.ink : "white"}>
                {formats.pct(row.shares[category.key])}</b>
            {/if}
          </span>
        {/each}
      </span>
    </button>
  {/each}
  {#if keyBelow}
    <p class="key">
      {#each categories as category}
        <span><i style:background={colors.dots[category.key]}></i>{category.label}</span>
      {/each}
    </p>
  {/if}
  {#if unit}<p class="unit">{@html unit}</p>{/if}
</div>

<style>
  .bars {
    --label-width: 112px;
  }

  .names {
    position: relative;
    height: 20px;
    margin-left: calc(var(--label-width) + 18px);
    margin-right: 9px;
  }

  .names span {
    position: absolute;
    bottom: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--color-ink);
    font-size: var(--type-small);
    font-weight: 600;
    white-space: nowrap;
  }

  .names .middle {
    transform: translateX(-50%);
  }

  .names .end {
    transform: translateX(-100%);
  }

  .names i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .row {
    display: grid;
    grid-template-columns: var(--label-width) 1fr;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin-bottom: 4px;
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .row:hover {
    background: var(--color-paper);
  }

  .row[aria-pressed="true"] {
    border-color: var(--color-muted);
    background: var(--color-paper);
  }

  .label {
    color: var(--color-muted);
    font-size: var(--type-small);
    font-weight: 600;
    line-height: 1.2;
  }

  [aria-pressed="true"] .label {
    color: var(--color-ink);
  }

  .label small {
    display: block;
    color: var(--color-muted);
    font-size: 0.72rem;
    font-weight: 500;
  }

  .bar {
    display: flex;
    gap: 2px;
    height: 22px;
  }

  .segment {
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
    display: flex;
    align-items: center;
    min-width: 0;
    padding-left: 6px;
    border-radius: 3px;
  }

  .segment b {
    font-size: 0.75rem;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 6px 0 0;
    color: var(--color-ink);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .key i {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border-radius: 50%;
    vertical-align: -1px;
  }

  .unit {
    margin: 6px 0 0;
    color: var(--color-muted);
    font-size: var(--type-kicker);
  }
</style>
