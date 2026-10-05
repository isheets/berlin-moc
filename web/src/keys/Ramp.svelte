<script>
  import { fade } from "svelte/transition";
  import { domains, rampLabels, rampScale } from "../config/theme.js";

  /** A ramp's gradient with its end labels, ticks at `ticks` (values), and up to two markers on
   *  it, each tick in its marker's color and labeled above the bar: one marker centered on its
   *  tick, two each reaching away from the other, so they never collide:
   *  [{value, label, color, strong}]. With `center`, a ramp around 0 labels 0 so and both ends by
   *  their size, as the captions under them say which way. `reverse` runs it high to low, left
   *  to right: care trips' side of a gap first. `orMore`: the ends hold values past them too. */
  let { ramp, markers = [], ticks = [], captions = null, center = null, reverse = false,
        orMore = true } = $props();

  const [low, high] = $derived(domains[ramp]);
  const at = (value) => {
    const share = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return `${(reverse ? 1 - share : share) * 100}%`;
  };
  // The ramp's stops, left to right, hard edges and all.
  const gradient = $derived.by(() => {
    const { stops } = rampScale(ramp);
    if (reverse) stops.reverse();
    return `linear-gradient(to right, ${stops.map(([value, color]) => `${color} ${at(value)}`).join(", ")})`;
  });
  const label = (value) => (center != null && value === 0 ? center : rampLabels[ramp](value));
  const more = $derived(orMore ? " or more" : "");
  const lowLabel = $derived(center != null ? `${rampLabels[ramp](Math.abs(low))}${more}` : rampLabels[ramp](low));
  const highLabel = $derived(`${rampLabels[ramp](high)}${more}`);
  // With two markers, the label of the one further left reaches left, the other's right.
  const position = (value) => parseFloat(at(value));
  const reach = (i) => markers.length < 2 ? "center"
    : position(markers[i].value) <= position(markers[1 - i].value) ? "leftward" : "rightward";
</script>

<div class="ramp">
  {#if markers.length}
    <div class="marks top">
      {#each markers as marker, i (i)}
        <!-- A label that changes sides fades out and back in on its new side once its tick has
             moved, rather than jumping across it. -->
        {#key reach(i)}
          <span class="marker {reach(i)}" class:strong={marker.strong} style:left={at(marker.value)}
                in:fade={{ delay: 450, duration: 200 }} out:fade={{ duration: 120 }}>
            <i style:background={marker.color}></i>{marker.label}
          </span>
        {/key}
      {/each}
    </div>
  {/if}
  <div class="bar" style:background={gradient}>
    {#each ticks as tick}
      <span class="notch" style:left={at(tick)}></span>
    {/each}
    {#each markers as marker, i (i)}
      <span class="tick" style:left={at(marker.value)} style:background={marker.color}></span>
    {/each}
  </div>
  <div class="ends">
    <span>{reverse ? highLabel : lowLabel}</span>
    {#each ticks as tick}
      <span class="tick-label" style:left={at(tick)}>{label(tick)}</span>
    {/each}
    <span>{reverse ? lowLabel : highLabel}</span>
  </div>
  {#if captions}
    <div class="captions"><span>{captions[0]}</span><span>{captions[1]}</span></div>
  {/if}
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

  /* Two markers: each label reaches away from the other, its dot over its tick. */
  .marker.leftward {
    flex-direction: row-reverse;
    transform: translateX(calc(-100% + 4px));
  }

  .marker.rightward {
    transform: translateX(-4px);
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
    top: -4px;
    bottom: -4px;
    width: 3px;
    margin-left: -1.5px;
    border-radius: 1px;
    background: var(--color-muted);
    box-shadow: 0 0 0 1.5px rgb(255 255 255 / 0.9);    /* a ring, apart from any ramp color */
    transition: left 600ms ease;
  }

  .notch {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgb(255 255 255 / 0.85);
  }

  .captions {
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
    font-weight: 600;
  }

  .tick-label {
    position: absolute;
    transform: translateX(-50%);
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
