<script>
  import { colors } from "../config/theme.js";
  import { apportion } from "../lib/text.js";

  /** Groups as waffles of squares, one per `per` trips a weekday, colored by category, filled
   *  column by column so each category is one block: a bigger group has more squares, and each
   *  block's size is its trips. Without `per`, each group is instead a bar the row's full width,
   *  split by share, for when only the shares matter. A row is a button that shows its group on
   *  the map. The categories are named over the first row's blocks, nudged apart where they would
   *  touch. rows: [{key, label, sub, total (waffles only), shares: {category: share},
   *  onBar: {category: text} (bars only, optional: written on that category's part)}];
   *  categories: [{key, label}]. */
  let { rows, categories, per, selected, select, unit } = $props();

  const HIGH = 4;                     // squares to a column
  const PITCH = 14;                   // px from one square to the next
  const counts = $derived(per ? rows.map((row) => apportion(
    Object.fromEntries(categories.map((c) => [c.key, row.shares[c.key]])), Math.round(row.total / per))) : []);
  const squares = (r) => categories.flatMap((c) => Array(counts[r][c.key]).fill(c.key));
  let bars = $state([]);              // each bar's width in px

  // Each category's span in the first row, in px from its start, for its name.
  const spans = $derived.by(() => {
    let at = 0;
    return categories.map((c) => {
      const start = at;
      if (!per) {
        at += rows[0].shares[c.key];
        return [start * (bars[0] ?? 0), at * (bars[0] ?? 0)];
      }
      at += counts[0][c.key];
      return [Math.floor(start / HIGH) * PITCH, Math.ceil(at / HIGH) * PITCH - 2];
    });
  });
  let widths = $state([]);
  const GAP = 12;
  const names = $derived.by(() => {
    const end = spans.at(-1)?.[1] ?? 0;
    const left = spans.map(([a, b], i) => {
      const w = widths[i] ?? 0;
      return i === 0 ? a : i === spans.length - 1 ? b - w : (a + b) / 2 - w / 2;
    });
    for (let i = 1; i < left.length; i++) left[i] = Math.max(left[i], left[i - 1] + (widths[i - 1] ?? 0) + GAP);
    for (let i = left.length - 1; i >= 0; i--) {
      const limit = i === left.length - 1 ? Math.max(end, left[i] + (widths[i] ?? 0)) : left[i + 1] - GAP;
      left[i] = Math.max(0, Math.min(left[i], limit - (widths[i] ?? 0)));
    }
    return left;
  });
</script>

<div class="waffles" style:--pitch={`${PITCH}px`} style:--high={HIGH}>
  <div class="names" aria-hidden="true">
    {#each categories as category, i}
      <span bind:offsetWidth={widths[i]} style:left={`${names[i]}px`}>
        <i style:background={colors.dots[category.key]}></i>{category.label}
      </span>
    {/each}
  </div>
  {#each rows as row, r}
    <button type="button" class="row" aria-pressed={selected === row.key} onclick={() => select(row.key)}
            aria-label={`${row.label}, ${row.sub}: ${categories.map((c) => `${c.label} ${Math.round(row.shares[c.key] * 100)}%`).join(", ")}`}>
      <span class="label"><i class="radio" aria-hidden="true"></i>
        <span>{row.label}{#if row.sub}<small>{row.sub}</small>{/if}</span></span>
      {#if per}
        <span class="waffle" aria-hidden="true">
          {#each squares(r) as category}
            <i style:background={colors.dots[category]}></i>
          {/each}
        </span>
      {:else}
        <span class="bar" aria-hidden="true" bind:clientWidth={bars[r]}>
          {#each categories as category}
            <i style:flex-grow={row.shares[category.key]} style:background={colors.dots[category.key]}
              >{#if row.onBar?.[category.key]}<b>{row.onBar[category.key]}</b>{/if}</i>
          {/each}
        </span>
      {/if}
    </button>
  {/each}
  {#if unit}<p class="unit">{@html unit}</p>{/if}
</div>

<style>
  .waffles {
    --label-width: 132px;
  }

  .names {
    position: relative;
    height: 24px;
    margin-left: calc(var(--label-width) + 21px);
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

  .names i {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  .row {
    display: grid;
    grid-template-columns: var(--label-width) 1fr;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin-bottom: 6px;
    padding: 8px 10px;
    border: 1px solid var(--color-hairline);
    border-radius: 8px;
    background: none;
    text-align: left;
    cursor: pointer;
    transition: border-color 150ms, background 150ms;
  }

  .row:hover {
    border-color: var(--color-muted);
    background: var(--color-paper);
  }

  .row[aria-pressed="true"] {
    border-color: var(--color-accent);
    background: var(--color-paper);
  }

  .radio {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--color-muted);
    border-radius: 50%;
  }

  [aria-pressed="true"] .radio {
    border: 4px solid var(--color-accent);
  }

  .label {
    display: flex;
    align-items: center;
    gap: 8px;
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

  /* Squares fill each column top to bottom, then the next column. */
  .waffle {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(var(--high), calc(var(--pitch) - 2px));
    grid-auto-columns: calc(var(--pitch) - 2px);
    gap: 2px;
  }

  .waffle i {
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
  }

  /* Or one bar, split by share, as tall as two squares. */
  .bar {
    display: flex;
    gap: 2px;
    height: calc(2 * var(--pitch) - 2px);
  }

  .bar i {
    display: flex;
    align-items: center;
    flex-basis: 0;
    overflow: hidden;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
  }

  .bar b {
    padding-left: 6px;
    color: var(--color-ink);
    font-size: 0.72rem;
    font-style: normal;
    font-weight: 600;
    white-space: nowrap;
  }

  .unit {
    margin: 8px 0 0;
    color: var(--color-muted);
    font-size: var(--type-kicker);
  }
</style>
