<script>
  import { onMount } from "svelte";
  import { colors, map as settings } from "../config/theme.js";
  import { explainer, minuteOf } from "../lib/explainer.svelte.js";
  import { covered, doingAt, position } from "../lib/race.js";

  /** Step 2's example trip on the map, for the explainer: its two ends, named, then each way once
   *  the reader runs it, on that run's clock: the route faint ahead of the traveler and full
   *  behind, the traveler labeled with what it's doing, and for public transport, the stops where
   *  it boards and leaves a ride. Drawn over the
   *  map in screen pixels, projected again as the camera moves; it fades in and out with its
   *  state. map: the MapLibre map; race: the trip's ways (race.js raceOf); shown: whether the
   *  state shows it; words: story.yaml's `explainer`. */
  let { map, race, shown, words } = $props();

  let moved = $state(0);           // bumped as the camera moves, so the routes follow it
  onMount(() => {
    const move = () => moved++;
    map.on("move", move);
    return () => map.off("move", move);
  });

  // The ways run so far. The car's label above it, public transport's below, so the two never
  // overprint.
  const ways = $derived([
    { key: "car", stages: race.car, color: colors.car, label: words.car, side: -1 },
    { key: "pt", stages: race.pt, color: colors.pt, label: words.pt, side: 1 },
  ].filter((way) => explainer.runs[way.key] != null)
    .map((way) => ({ ...way, minute: minuteOf(way.key, race.minutes[way.key]) })));

  /** What a way's traveler is doing, in words, or once there, its minutes door to door. */
  function doing(way) {
    const end = race.minutes[way.key];
    const { doing: what, line = "", stop = "" } = doingAt(way.stages, way.minute, end);
    return words.status[what].replace("{line}", line).replace("{stop}", stop)
      .replace("{minutes}", String(Math.round(end)));
  }
  // A stop named like an end (a bus stop called after its area) is left to the end's name.
  const stops = $derived(explainer.runs.pt == null ? []
    : race.stops.filter((stop) => !race.ends.some((end) => end.name === stop.name)));

  /** A point on screen for a [lon, lat] one, for the camera as it is now. */
  function place(point) {
    void moved;
    const { x, y } = map.project(point);
    return [x, y];
  }
  const line = (points) => points.map((point) => place(point).map((v) => v.toFixed(1)).join(",")).join(" ");
</script>

<svg class="race" class:shown aria-hidden="true" style:--drive={`${settings.race.width.drive}px`}
     style:--ride={`${settings.race.width.ride}px`} style:--walk={`${settings.race.width.walk}px`}>
  {#each ways as way}
    {#each way.stages.filter((stage) => stage.path) as stage}
      <polyline class={`route ${stage.kind} ahead`} points={line(stage.path.points)} />
    {/each}
  {/each}
  {#each ways as way}
    {#each covered(way.stages, way.minute) as part}
      <polyline class={`route ${part.kind}`} points={line(part.points)} />
    {/each}
  {/each}
  <!-- Names to the left, so the travelers' labels, to the right, keep clear of them. -->
  {#each race.ends as end}
    {@const [x, y] = place(end.point)}
    <g class="end" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <circle r="5" />
      <text x="-10" y="4">{end.name}</text>
    </g>
  {/each}
  {#each stops as stop}
    {@const [x, y] = place(stop.point)}
    <g class="stop" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <circle r="4" />
      <text x="-8" y="4">{stop.name}</text>
    </g>
  {/each}
  <!-- Each traveler, pulsing while it waits for a ride. -->
  {#each ways as way}
    {@const { at, stage } = position(way.stages, way.minute)}
    {@const [x, y] = place(at)}
    <g class="marker" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      {#if stage?.kind === "wait"}<circle class="pulse" r="7" fill={way.color} />{/if}
      <circle r="7" fill={way.color} />
      <text x="11" y={way.side < 0 ? -24 : 19}>{way.label}</text>
      <text class="doing" x="11" y={way.side < 0 ? -9 : 34}>{doing(way)}</text>
    </g>
  {/each}
</svg>

<style>
  .race {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--fade-ms) ease;
  }

  .race.shown {
    opacity: 1;
  }

  .route {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .route.drive {
    stroke: var(--color-car);
    stroke-width: var(--drive);
  }

  .route.ride {
    stroke: var(--color-pt);
    stroke-width: var(--ride);
  }

  /* Walking as a line of dots. */
  .route.walk {
    stroke: var(--color-ground-text);
    stroke-width: var(--walk);
    stroke-dasharray: 0.1 7;
  }

  .route.ahead {
    opacity: 0.3;
  }

  .end circle {
    fill: var(--color-ground);
    stroke: var(--color-ground-text);
    stroke-width: 2;
  }

  .stop circle {
    fill: var(--color-ground);
    stroke: var(--color-pt);
    stroke-width: 2;
  }

  .end text,
  .stop text {
    fill: var(--color-ground-text);
    font: 500 12px var(--type-family);
    text-anchor: end;
    stroke: var(--color-ground);
    stroke-width: 3px;
    paint-order: stroke;
  }

  .end text {
    font-size: 13px;
    font-weight: 700;
  }

  .marker circle {
    stroke: var(--color-ground);
    stroke-width: 2.5;
  }

  /* With a halo like the basemap's labels. */
  .marker text {
    fill: var(--color-ground-text);
    font: 600 13px var(--type-family);
    stroke: var(--color-ground);
    stroke-width: 3px;
    paint-order: stroke;
  }

  .marker .doing {
    font-size: 12px;
    font-weight: 500;
  }

  .marker .pulse {
    stroke: none;
    transform-box: fill-box;
    transform-origin: center;
    animation: pulse 900ms ease-out infinite;
  }

  @keyframes pulse {
    from {
      opacity: 0.45;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(2.6);
    }
  }
</style>
