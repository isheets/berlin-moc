<script>
  import { colors, layout } from "../config/theme.js";
  import { apportion } from "../lib/text.js";

  /** Groups as waffles of squares, one per `per` trips a weekday, colored by category, filled
   *  column by column so each category is one block: a bigger group has more squares, and each
   *  block's size is its trips. The fullest waffle spans its row, and the squares are sized to
   *  fit. Without `per`, each group is instead a bar the row's full width, split by share, for
   *  when only the shares matter. A row is a button that shows its group on the map. The
   *  categories are named over the first row's blocks, nudged apart where they would touch.
   *  rows: [{key, label, sub, total (waffles only), shares: {category: share},
   *  onBar: {category: text} (bars only, optional: written on that category's part)}];
   *  categories: [{key, label, control (optional: a snippet that names the category in place of
   *  its label, with a control in it)}]. */
  let { rows, categories, per, selected, select } = $props();

  const counts = $derived(per ? rows.map((row) => apportion(
    Object.fromEntries(categories.map((c) => [c.key, row.shares[c.key]])), Math.round(row.total / per))) : []);
  const squares = (r) => categories.flatMap((c) => Array(counts[r][c.key]).fill(c.key));
  const columns = $derived(Math.max(0, ...counts.map((_, r) => Math.ceil(squares(r).length / layout.waffleRows))));
  let room = $state([]);              // each row's width beside its label, in px
  // px from one square to the next: the fullest waffle's columns fill the room, 2px apart.
  const pitch = $derived(columns ? ((room[0] ?? 0) + 2) / columns : 0);

  // Each category's span in the first row, in px from its start, for its name.
  const spans = $derived.by(() => {
    let at = 0;
    return categories.map((c) => {
      const start = at;
      if (!per) {
        at += rows[0].shares[c.key];
        return [start * (room[0] ?? 0), at * (room[0] ?? 0)];
      }
      at += counts[0][c.key];
      return [Math.floor(start / layout.waffleRows) * pitch, Math.ceil(at / layout.waffleRows) * pitch - 2];
    });
  });
  let widths = $state([]);
  const GAP = 12;
  const LABEL = 140;                  // px, the column of group names
  const INSET = LABEL + 21;           // px from the row's edge to its squares
  // Each name over its block, nudged apart, kept within the squares' end and, where they need it,
  // reaching left over the group names.
  const names = $derived.by(() => {
    const end = spans.at(-1)?.[1] ?? 0;
    const left = spans.map(([a, b], i) => {
      const w = widths[i] ?? 0;
      return i === 0 ? a : i === spans.length - 1 ? b - w : (a + b) / 2 - w / 2;
    });
    for (let i = 1; i < left.length; i++) left[i] = Math.max(left[i], left[i - 1] + (widths[i - 1] ?? 0) + GAP);
    for (let i = left.length - 1; i >= 0; i--) {
      const limit = i === left.length - 1 ? end : left[i + 1] - GAP;
      left[i] = Math.max(-INSET, Math.min(left[i], limit - (widths[i] ?? 0)));
    }
    return left;
  });

  // A share written on its part of a bar, and hidden where the part is too narrow to hold it.
  let written = $state({});           // each written share's width, by `${row}-${category}`
  const PAD = 8;
  function onBar(r, c) {
    const free = (room[r] ?? 0) - 2 * (categories.length - 1);
    const shares = categories.map((category) => rows[r].shares[category.key]);
    const start = shares.slice(0, c).reduce((sum, share) => sum + share, 0) * free + 2 * c;
    return { fits: shares[c] * free >= (written[`${r}-${c}`] ?? 0) + 2 * PAD, left: start + PAD };
  }
</script>

<div class="waffles" style:--pitch={`${pitch}px`} style:--rows={layout.waffleRows}
     style:--label-width={`${LABEL}px`} style:--inset={`${INSET}px`}>
  <!-- The rows' own labels name the categories too, so a name is hidden from screen readers
       unless it holds a control. -->
  <div class="names">
    {#each categories as category, i}
      <span bind:offsetWidth={widths[i]} style:left={`${names[i]}px`}
            aria-hidden={category.control ? undefined : "true"}>
        <i style:background={colors.dots[category.key]} aria-hidden="true"></i>
        {#if category.control}{@render category.control()}{:else}{category.label}{/if}
      </span>
    {/each}
  </div>
  {#each rows as row, r}
    <button type="button" class="row" aria-pressed={selected === row.key} onclick={() => select(row.key)}
            style:--mark={colors[`${row.key}Text`]}
            aria-label={`${row.label}, ${row.sub}: ${categories.map((c) => `${c.label} ${Math.round(row.shares[c.key] * 100)}%`).join(", ")}`}>
      <span class="label"><i class="radio" aria-hidden="true"></i>
        <span>{row.label}{#if row.sub}<small>{row.sub}</small>{/if}</span></span>
      {#if per}
        <span class="waffle" aria-hidden="true" bind:clientWidth={room[r]}>
          {#each squares(r) as category}
            <i style:background={colors.dots[category]}></i>
          {/each}
        </span>
      {:else}
        <span class="bar" aria-hidden="true" bind:clientWidth={room[r]}>
          {#each categories as category}
            <i style:flex-grow={row.shares[category.key]} style:background={colors.dots[category.key]}></i>
          {/each}
          {#each categories as category, c}
            {#if row.onBar?.[category.key]}
              {@const place = onBar(r, c)}
              <b class:hidden={!place.fits} style:left={`${place.left}px`}
                 bind:offsetWidth={written[`${r}-${c}`]}>{row.onBar[category.key]}</b>
            {/if}
          {/each}
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .names {
    position: relative;
    height: 38px;
    margin-left: var(--inset);
  }

  /* Each category's name and color, large: they name it on the map as well as in the waffle. A
     legend, not a control, so no outline or fill. */
  .names span {
    position: absolute;
    bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;                     /* one line for all, a control's included */
    color: var(--color-ink);
    font-size: 1rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .names i {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }

  /* The label, then the room left for the waffle or bar, which its squares never widen. */
  .row {
    display: grid;
    grid-template-columns: var(--label-width) minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    width: 100%;
    margin-bottom: 6px;
    padding: 10px;
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

  /* In the group's color on the map, picked or not. */
  .radio {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--mark, var(--color-muted));
    border-radius: 50%;
  }

  [aria-pressed="true"] .radio {
    border: 4px solid var(--mark, var(--color-accent));
  }

  .label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-muted);
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.25;
  }

  [aria-pressed="true"] .label {
    color: var(--color-ink);
  }

  .label small {
    display: block;
    margin-top: 2px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 500;
    white-space: nowrap;
  }

  /* Squares fill each column top to bottom, then the next column. */
  .waffle {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(var(--rows), calc(var(--pitch) - 2px));
    grid-auto-columns: calc(var(--pitch) - 2px);
    gap: 2px;
  }

  .waffle i {
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
  }

  /* Or one bar, split by share. */
  .bar {
    position: relative;
    display: flex;
    gap: 2px;
    height: 36px;
  }

  /* Growing or shrinking when the shares change, as when step 5's minutes do. */
  .bar i {
    flex-basis: 0;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.1);
    transition: flex-grow 400ms ease;
  }

  /* Fading out as its part shrinks past it, and back in. */
  .bar b {
    position: absolute;
    top: 50%;
    color: var(--color-ink);
    font-size: 0.9rem;
    font-weight: 700;
    white-space: nowrap;
    transform: translateY(-50%);
    transition: left 400ms ease, opacity 200ms;
  }

  .bar b.hidden {
    opacity: 0;
  }
</style>
