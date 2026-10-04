<script>
  import { colors, domains, rampLabels } from "../config/theme.js";

  /** What the map shows now (a state from states.js), in the words of story.yaml's `legend`.
   *  compare: the point offers a second map, switched by the toggle bound to `comparing`. */
  let { state, words, compare, comparing = $bindable(false) } = $props();

  const zones = $derived(state?.zones);
  const lineGroups = $derived(Object.keys(state?.tripLines ?? {}));
  const hasContent = $derived(Boolean(compare || zones || lineGroups.length || state?.trip
    || state?.network));
  const gradient = (ramp) => `linear-gradient(to right, ${colors[ramp].join(", ")})`;
</script>

{#if hasContent}
  <aside class="legend" aria-label="Map legend">
    {#if compare}
      <div class="toggle" role="group" aria-label="Show on the map">
        {#each words.compare as label, i}
          <button type="button" aria-pressed={comparing === (i === 1)}
                  onclick={() => (comparing = i === 1)}>{label}</button>
        {/each}
      </div>
    {/if}

    {#if zones}
      <p class="title">{words.ramps[zones.ramp]}</p>
      <div class="ramp" style:background={gradient(zones.ramp)}></div>
      <div class="ends">
        <span>{rampLabels[zones.ramp](domains[zones.ramp][0])}</span>
        <span>{rampLabels[zones.ramp](domains[zones.ramp][1])}</span>
      </div>
      <p class="key"><span class="swatch" style:background={colors.noData}></span>{words.noData}</p>
    {/if}

    {#if lineGroups.length}
      <p class="title">{words.tripLines}</p>
      {#each lineGroups as group}
        <p class="key"><span class="line" style:background={colors[group]}></span>{words.groups[group]}</p>
      {/each}
    {/if}

    {#if state?.trip}
      <p class="key"><span class="line thick" style:background={colors.car}></span>{words.trip.car}</p>
      <p class="key"><span class="line thick" style:background={colors.pt}></span>{words.trip.ride}</p>
      <p class="key"><span class="dotted" style:color={colors.walk}></span>{words.trip.walk}</p>
      <p class="key"><span class="ring"></span>{words.trip.transfer}</p>
    {/if}

    {#if state?.network?.lines}
      <p class="key"><span class="line thick" style:background={colors.pt}></span>{words.network}</p>
    {/if}
    {#if state?.network?.coverage}
      <p class="key"><span class="swatch" style:background={colors.pt} style:opacity="0.45"></span>
        {words.coverage.newly_covered}</p>
      <p class="key"><span class="swatch" style:background={colors.notCovered} style:opacity="0.45"></span>
        {words.coverage.not_covered}</p>
    {/if}
  </aside>
{/if}

<style>
  /* Under the story panel on desktop, in a slot of fixed height so the panel never moves. */
  .legend {
    position: fixed;
    top: calc(100vh - var(--gutter) - var(--legend-height));
    left: var(--gutter);
    z-index: 2;
    width: var(--card-width);
    max-height: var(--legend-height);
    overflow-y: auto;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08), 0 6px 20px rgb(0 0 0 / 0.06);
    font-size: var(--type-kicker);
    line-height: 1.35;
  }

  .toggle {
    display: flex;
    margin-bottom: 10px;
    padding: 2px;
    border-radius: 999px;
    background: var(--color-paper);
  }

  .toggle button {
    flex: 1;
    padding: 5px 8px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
    font-weight: 600;
    cursor: pointer;
  }

  .toggle [aria-pressed="true"] {
    background: var(--color-accent);
    color: white;
  }

  .title {
    margin: 0 0 6px;
    color: var(--color-ink-secondary);
    font-weight: 600;
  }

  .ramp {
    height: 10px;
    border-radius: 2px;
  }

  .ends {
    display: flex;
    justify-content: space-between;
    margin: 3px 0 6px;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .key {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 4px;
    color: var(--color-ink-secondary);
  }

  .swatch {
    flex: none;
    width: 14px;
    height: 10px;
    border-radius: 2px;
  }

  .line {
    flex: none;
    width: 18px;
    height: 2px;
    border-radius: 1px;
  }

  .line.thick {
    height: 4px;
  }

  .dotted {
    flex: none;
    width: 18px;
    height: 4px;
    background: radial-gradient(circle, currentColor 1.6px, transparent 1.8px) 0 50% / 6px 4px repeat-x;
  }

  .ring {
    flex: none;
    width: 12px;
    height: 12px;
    margin: 0 3px;
    border: 3px solid var(--color-ink);
    border-radius: 50%;
    background: var(--color-paper);
  }

  :global(.phone) .legend {
    top: 12px;
    right: 12px;
    left: auto;
    width: min(220px, 60vw);
    max-height: 40vh;
    padding: 8px 10px;
  }
</style>
