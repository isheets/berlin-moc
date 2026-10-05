<script>
  import { colors, domains, rampLabels } from "../config/theme.js";

  /** A ramp's gradient with its end labels, ticks at `ticks` (values), and up to two markers on
   *  it, one labeled above the bar and one below, so they never collide:
   *  [{value, label, color, strong}]. */
  let { ramp, markers = [], ticks = [] } = $props();

  const [low, high] = $derived(domains[ramp]);
  const at = (value) => `${Math.max(0, Math.min(1, (value - low) / (high - low))) * 100}%`;
</script>

<div class="ramp">
  {#each markers as marker, i (i)}
    {#if i === 0}
      <div class="marks top">
        <span class="marker" class:strong={marker.strong} style:left={at(marker.value)}>
          <i style:background={marker.color}></i>{marker.label}
        </span>
      </div>
    {/if}
  {/each}
  <div class="bar" style:background={`linear-gradient(to right, ${colors[ramp].join(", ")})`}>
    {#each ticks as tick}
      <span class="notch" style:left={at(tick)}></span>
    {/each}
    {#each markers as marker, i (i)}
      <span class="tick" class:strong={marker.strong} style:left={at(marker.value)}></span>
    {/each}
  </div>
  {#if markers[1]}
    <div class="marks bottom">
      <span class="marker" class:strong={markers[1].strong} style:left={at(markers[1].value)}>
        <i style:background={markers[1].color}></i>{markers[1].label}
      </span>
    </div>
  {/if}
  <div class="ends">
    <span>{rampLabels[ramp](low)}</span>
    {#each ticks as tick}
      <span class="tick-label" style:left={at(tick)}>{rampLabels[ramp](tick)}</span>
    {/each}
    <span>{rampLabels[ramp](high)} or more</span>
  </div>
</div>

<style>
  .marks {
    position: relative;
    height: 20px;
  }

  .marker {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    white-space: nowrap;
    transform: translateX(-50%);
    transition: left 600ms ease;
  }

  .top .marker {
    bottom: 3px;
  }

  .bottom .marker {
    top: 3px;
  }

  .marker.strong {
    color: var(--color-ink);
  }

  .marker i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .bar {
    position: relative;
    height: 10px;
    border-radius: 2px;
  }

  .tick {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    margin-left: -1px;
    background: var(--color-muted);
    transition: left 600ms ease;
  }

  .notch {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgb(255 255 255 / 0.85);
  }

  .tick-label {
    position: absolute;
    transform: translateX(-50%);
  }

  .tick.strong {
    background: var(--color-ink);
  }

  .ends {
    position: relative;
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
    color: var(--color-muted);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }
</style>
