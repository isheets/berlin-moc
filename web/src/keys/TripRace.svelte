<script>
  import { onDestroy } from "svelte";
  import { colors, motion } from "../config/theme.js";
  import { shownTrip, timeline, typicalTrips } from "../lib/data.js";
  import { minuteAt, play, playback, stop } from "../lib/playback.svelte.js";

  /** The typical trip as two time strips, car above public transport, filling in on the race's
   *  clock while the map runs it. words: story.yaml's `race`. */
  let { data, group = "care", words } = $props();

  const trip = $derived(shownTrip(data.typical, group, playback.selected[group]));
  const stages = $derived(trip ? timeline(trip) : { pt: [], car: [] });
  const end = $derived(trip?.pt.minutes ?? 0);
  const axisEnd = $derived(Math.ceil(end / 5) * 5);

  // Each group plays from the start when it comes into view, once the camera has arrived.
  $effect(() => {
    group;
    play(motion.flyMs);
  });
  onDestroy(stop);

  let now = $state(performance.now());
  $effect(() => {
    const startedAt = playback.startedAt;
    if (startedAt == null) return;
    let id;
    const tick = (t) => {
      now = t;
      if (t < startedAt || minuteAt(t, end) < end) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  });
  const minute = $derived(minuteAt(now, end));

  function another() {
    const others = typicalTrips(data.typical, group).filter((other) => other !== trip);
    playback.selected[group] = others[Math.floor(Math.random() * others.length)].trip_id;
    play(motion.flyMs);
  }

  let width = $state(380);
  const LABEL = 0;
  const x = (m) => LABEL + (m / axisEnd) * (width - LABEL);
  const fill = { walk: colors.walk, wait: colors.wait, park: colors.wait, ride: colors.pt, drive: colors.car };

  const rows = $derived([
    { key: "car", label: words.car, stages: stages.car, total: trip?.car.minutes ?? 0 },
    { key: "pt", label: words.pt, stages: stages.pt, total: end },
  ]);
  const walking = (row) => row.stages.filter((s) => s.kind === "walk").reduce((sum, s) => sum + s.end - s.start, 0);
  const round = (m) => Math.round(m);
</script>

{#if trip}
  <figure class="race">
    <div class="rows" bind:clientWidth={width}>
      {#each rows as row}
        {@const done = minute >= row.total}
        <div class="row">
          <p class="label">
            <span>{row.label}</span>
            <span class="total" class:done>
              {round(Math.min(minute, row.total))} min{#if done && walking(row) > 1}<span class="walked">, {round(walking(row))} {words.walking}</span>{/if}
            </span>
          </p>
          <svg {width} height="22" role="img"
               aria-label={`${row.label}: ${round(row.total)} minutes, ${round(walking(row))} of them walking`}>
            <rect x="0" y="0" width={width} height="22" rx="4" fill={colors.paper} />
            {#each row.stages as stage}
              {#if minute > stage.start}
                {@const left = x(stage.start)}
                {@const right = x(Math.min(stage.end, minute))}
                <rect x={left + 1} y="0" width={Math.max(0, right - left - 2)} height="22" rx="3"
                      fill={fill[stage.kind]} stroke="rgb(0 0 0 / 0.08)" />
                {#if stage.line && right - left > 30}
                  <text x={left + 6} y="15" class="line">{stage.line}</text>
                {/if}
              {/if}
            {/each}
          </svg>
        </div>
      {/each}
      <div class="playhead" style:left={`${x(minute)}px`} class:hidden={minute >= end}></div>
    </div>
    <div class="axis">
      <span>0</span><span>{axisEnd / 2} min</span><span>{axisEnd} min</span>
    </div>
    <div class="key">
      <span><i style:background={colors.walk}></i>{words.stages.walk}</span>
      <span><i style:background={colors.wait}></i>{words.stages.wait}</span>
      <span><i style:background={colors.pt}></i>{words.stages.ride}</span>
      <span><i style:background={colors.car}></i>{words.stages.drive}</span>
    </div>
    <div class="actions">
      <button type="button" onclick={() => play(0)}>↺ {words.replay}</button>
      <button type="button" onclick={another}>⤨ {words.another}</button>
    </div>
  </figure>
{/if}

<style>
  .race {
    margin: 4px 0 12px;
  }

  .rows {
    position: relative;
  }

  .row {
    margin-bottom: 8px;
  }

  .label {
    display: flex;
    justify-content: space-between;
    margin: 0 0 3px;
    font-size: var(--type-small);
    font-weight: 600;
  }

  .total {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .total.done {
    color: var(--color-ink);
  }

  .walked {
    color: var(--color-ink-secondary);
    font-weight: 500;
  }

  svg {
    display: block;
  }

  .line {
    fill: white;
    font-size: 11px;
    font-weight: 700;
  }

  .playhead {
    position: absolute;
    top: 18px;
    bottom: -4px;
    width: 2px;
    margin-left: -1px;
    background: var(--color-ink);
  }

  .playhead.hidden {
    display: none;
  }

  .axis {
    display: flex;
    justify-content: space-between;
    color: var(--color-muted);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 8px;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
  }

  .key i {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 5px;
    border-radius: 2px;
    vertical-align: -1px;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .actions button {
    padding: 5px 12px;
    border: 1px solid var(--color-hairline);
    border-radius: 999px;
    background: var(--color-card);
    color: var(--color-ink);
    font-size: var(--type-kicker);
    font-weight: 600;
    cursor: pointer;
  }

  .actions button:hover {
    border-color: var(--color-muted);
  }
</style>
