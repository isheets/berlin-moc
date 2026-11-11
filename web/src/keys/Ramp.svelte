<script>
  import { fade } from "svelte/transition";
  import { domains, rampLabels, rampScale } from "../config/theme.js";

  /** A ramp's gradient with its end labels, ticks at `ticks` (values), and up to two markers on
   *  it, each tick in its marker's color and labeled above the bar: one marker centered on its
   *  tick, two each reaching away from the other, so they never collide, and both kept within the
   *  ramp: [{value, label, color, strong}]. With `center`, a ramp around 0 labels 0 so and both ends by
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
  const reach = (i) => {
    if (markers.length < 2) return "center";
    const [mine, other] = [position(markers[i].value), position(markers[1 - i].value)];
    return mine < other || (mine === other && i === 0) ? "leftward" : "rightward";
  };

  // Each label's left, in px: centered on its tick, or reaching away from the other with its dot
  // over its tick; then kept within the ramp and apart, its dot leaving the tick only at an edge.
  let width = $state(0);
  let widths = $state([]);
  const DOT = 5;                      // px from a label's edge to its dot's center
  const GAP = 10;
  const lefts = $derived.by(() => {
    const x = markers.map((marker) => (position(marker.value) / 100) * width);
    const w = markers.map((_, i) => widths[i] ?? 0);
    const within = (left, i) => Math.max(0, Math.min(left, width - w[i]));
    if (markers.length < 2) return x.map((at, i) => within(at - w[i] / 2, i));
    const [a, b] = reach(0) === "leftward" ? [0, 1] : [1, 0];
    const left = [];
    left[a] = within(x[a] - w[a] + DOT, a);
    left[b] = within(Math.max(x[b] - DOT, left[a] + w[a] + GAP), b);
    left[a] = within(Math.min(left[a], left[b] - GAP - w[a]), a);
    return left;
  });
  // Placed once measured, without sliding there.
  let placed = $state(false);
  $effect(() => {
    if (!placed && width && markers.every((_, i) => widths[i])) requestAnimationFrame(() => (placed = true));
  });
</script>

<div class="ramp">
  {#if markers.length}
    <div class="marks top" class:placed bind:clientWidth={width}>
      {#each markers as marker, i (i)}
        <!-- A label that changes sides fades out and back in on its new side once its tick has
             moved, rather than jumping across it. -->
        {#key reach(i)}
          <span class="marker {reach(i)}" class:strong={marker.strong} style:left={`${lefts[i]}px`}
                bind:offsetWidth={widths[i]}
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
    height: 26px;
  }

  .marker {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--color-muted);
    font-size: var(--type-small);
    font-weight: 600;
    white-space: nowrap;
    visibility: hidden;
  }

  .placed .marker {
    visibility: visible;
    transition: left 600ms ease;
  }

  .top .marker {
    bottom: 5px;
  }

  /* Two markers: each label reaches away from the other, its dot on the side of its tick. */
  .marker.leftward {
    flex-direction: row-reverse;
  }

  .marker.strong {
    color: var(--color-ink);
  }

  .marker i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .bar {
    position: relative;
    height: 16px;
    border-radius: 3px;
  }

  .tick {
    position: absolute;
    top: -6px;
    bottom: -6px;
    width: 4px;
    margin-left: -2px;
    border-radius: 1px;
    background: var(--color-muted);
    box-shadow: 0 0 0 2px rgb(255 255 255 / 0.9);    /* a ring, apart from any ramp color */
    transition: left 600ms ease;
  }

  .notch {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: rgb(255 255 255 / 0.85);
  }

  .captions {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
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
    margin-top: 6px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-variant-numeric: tabular-nums;
  }
</style>
