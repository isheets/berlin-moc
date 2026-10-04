<script>
  // Stage B placeholder: names the chart each step will carry. Stage C swaps in the charts.
  let { name } = $props();

  const planned = {
    "mode-share": "Mode shares, care against work trips; public transport and car driver labeled",
    "ratio-hero": "Large ratio, with 10 minutes by car against the same trip by public transport",
    "ratio-bands": "Share of trips by ratio band, both groups; Lunke's figures on the first and last bands",
    "ratio-by-distance": "Median ratio by driving distance, both groups, with the typical trips marked",
    "trip-clock": "A clock and two time strips, car against public transport; Replay · Another typical trip",
    "time-split": "Mean minutes by stage, public transport against car, both groups",
    "coverage-meter": "Residents near a line every 10 minutes: today against the 10-minute network",
    "saved-tiles": "Minutes saved per trip, and the share of trips that get faster",
    "saved-by-stage": "Minutes saved by walking, waiting, and riding, both groups",
    "worst-band": "Trips over 3.5 times as long: today against the 10-minute network",
  };
</script>

<figure class="placeholder">
  <span>Chart · {name}</span>
  <figcaption>{planned[name] ?? ""}</figcaption>
</figure>

<style>
  .placeholder {
    margin: 4px 0 12px;
    padding: 14px 16px;
    border: 1px dashed var(--color-hairline);
    border-radius: 8px;
    background: var(--color-paper);
  }

  span {
    display: block;
    margin-bottom: 4px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  figcaption {
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    line-height: 1.4;
  }
</style>
