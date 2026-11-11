<script>
  import { colors } from "../config/theme.js";
  import { view } from "../lib/view.svelte.js";

  /** Driving-distance bands as rows, care trips to the left and commutes to the right, each bar a
   *  value for its group, labeled. A row is a button that shows its band on the map (view.band).
   *  rows: [{band: an index, or null for every distance; label; values: {care, commute} or null;
   *  labels: {care, commute}}]; groups: the groups' names. */
  let { rows, groups } = $props();

  const GROUPS = ["care", "commute"];
  const tallest = $derived(Math.max(...rows.flatMap((row) => (row.values ? GROUPS.map((g) => row.values[g]) : []))));
  const width = (value) => `${(value / tallest) * 100}%`;
</script>

<div class="rows" role="group">
  <p class="head" aria-hidden="true">
    <span class="care"><i style:background={colors.care}></i>{groups.care}</span>
    <span></span>
    <span class="commute">{groups.commute}<i style:background={colors.commute}></i></span>
  </p>
  {#each rows as row}
    <button type="button" class="row" aria-pressed={view.band === row.band}
            onclick={() => (view.band = row.band)}
            aria-label={row.values ? `${row.label}: ${row.labels.care} ${groups.care}, ${row.labels.commute} ${groups.commute}` : row.label}>
      <span class="side care">
        {#if row.values}
          <b>{row.labels.care}</b>
          <span class="bar" style:width={width(row.values.care)} style:background={colors.care}></span>
        {/if}
      </span>
      <span class="band"><i class="radio" aria-hidden="true"></i>{row.label}</span>
      <span class="side commute">
        {#if row.values}
          <span class="bar" style:width={width(row.values.commute)} style:background={colors.commute}></span>
          <b>{row.labels.commute}</b>
        {/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .rows {
    --band-width: 132px;
  }

  .head,
  .row {
    display: grid;
    grid-template-columns: 1fr var(--band-width) 1fr;
    align-items: center;
    gap: 8px;
  }

  /* Each group's name and color, large: they name it on the map as well as in the rows. A legend,
     not a control, so no outline or fill. */
  .head {
    margin: 0 0 8px;
    padding: 0 10px;
    color: var(--color-ink);
    font-size: 1rem;
    font-weight: 600;
  }

  .head span {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .head .care {
    justify-content: flex-end;
  }

  .head i {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }

  .row {
    width: 100%;
    margin-bottom: 5px;
    padding: 7px 10px;
    border: 1px solid var(--color-hairline);
    border-radius: 8px;
    background: none;
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

  .side {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 20px;
  }

  .side.care {
    justify-content: flex-end;
  }

  .bar {
    height: 14px;
    min-width: 2px;
    border-radius: 2px;
  }

  .side b {
    color: var(--color-ink-secondary);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  /* The band in the middle, with its radio dot. */
  .band {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--color-ink-secondary);
    font-size: 0.9rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  [aria-pressed="true"] .band {
    color: var(--color-ink);
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
</style>
