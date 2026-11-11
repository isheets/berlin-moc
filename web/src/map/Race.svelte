<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { colors, map as settings } from "../config/theme.js";
  import { explainer, minuteOf } from "../lib/explainer.svelte.js";
  import { covered, doingAt, position } from "../lib/race.js";
  import { iconOf } from "./icons.js";

  /** Step 2's example trip on the map, for the explainer: its two ends, named, then each way once
   *  the reader runs it, on that run's clock: the route faint ahead of the traveler and full
   *  behind, the traveler marked with an icon of what it's doing and tagged with it in words, and
   *  for public transport, the stops where it boards and leaves a ride. Drawn over the map in
   *  screen pixels, projected again as the camera moves; it fades in and out with its state.
   *  map: the MapLibre map; race: the trip's ways (race.js raceOf); shown: whether the state
   *  shows it; words: story.yaml's `explainer`. */
  let { map, race, shown, words } = $props();

  let moved = $state(0);           // bumped as the camera moves, so the routes follow it
  onMount(() => {
    const move = () => moved++;
    map.on("move", move);
    return () => map.off("move", move);
  });

  // The ways run so far, each with what its traveler is doing now (race.js doingAt). The car's
  // tag above it, public transport's below, so the two never overprint.
  const ways = $derived([
    { key: "car", stages: race.car, color: colors.car, label: words.car, side: -1 },
    { key: "pt", stages: race.pt, color: colors.pt, label: words.pt, side: 1 },
  ].filter((way) => explainer.runs[way.key] != null)
    .map((way) => {
      const minute = minuteOf(way.key, race.minutes[way.key]);
      return { ...way, minute, now: doingAt(way.stages, minute, race.minutes[way.key]) };
    }));

  /** What a way's traveler is doing, in words, or once there, its minutes door to door. */
  function doing(way) {
    const { doing: what, line = "", stop = "" } = way.now;
    return words.status[what].replace("{line}", line).replace("{stop}", stop)
      .replace("{minutes}", String(Math.round(race.minutes[way.key])));
  }
  const { marker, icon } = settings.race;
  // The named points: the trip's ends, and once public transport has run, its stops. A stop named
  // like an end (a bus stop called after its area) is left to the end's name.
  const points = $derived([
    ...race.ends.map((end) => ({ ...end, kind: "end", r: 5 })),
    ...(explainer.runs.pt == null ? [] : race.stops
      .filter((stop) => !race.ends.some((end) => end.name === stop.name))
      .map((stop) => ({ ...stop, kind: "stop", r: 4 }))),
  ]);

  /** A point on screen for a [lon, lat] one, for the camera as it is now. */
  function place(point) {
    void moved;
    const { x, y } = map.project(point);
    return [x, y];
  }
  const line = (points) => points.map((point) => place(point).map((v) => v.toFixed(1)).join(",")).join(" ");
</script>

<div class="race" class:shown aria-hidden="true">
<svg style:--drive={`${settings.race.width.drive}px`} style:--ride={`${settings.race.width.ride}px`}
     style:--walk={`${settings.race.width.walk}px`}>
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
  {#each points as { kind, point, r }}
    {@const [x, y] = place(point)}
    <circle class={kind} cx={x.toFixed(1)} cy={y.toFixed(1)} {r} />
  {/each}
  <!-- Each traveler, its icon cut out of its dot, pulsing while it waits for a ride. -->
  {#each ways as way}
    {@const { at, stage } = position(way.stages, way.minute)}
    {@const [x, y] = place(at)}
    {@const glyph = iconOf(way.now)}
    <g class="marker" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      {#if stage?.kind === "wait"}<circle class="pulse" r={marker} fill={way.color} />{/if}
      <circle r={marker} fill={way.color} />
      {#key glyph}
        <g class="icon" transform={`translate(${-icon / 2} ${-icon / 2}) scale(${icon / 24})`}
           in:fade={{ duration: 150 }}>{@html glyph}</g>
      {/key}
    </g>
  {/each}
  <!-- The points' names, over the travelers, so a dot that stops beside a point (the car, parked
       short of the door) never hides one. To the left, clear of a dot on the point, so the
       travelers' tags, to the right, keep clear of them. -->
  {#each points as { kind, name, point }}
    {@const [x, y] = place(point)}
    <text class={kind} x={(x - marker - 4).toFixed(1)} y={(y + 4).toFixed(1)}>{name}</text>
  {/each}
</svg>
<!-- Each traveler's name and what it's doing, on an underlay, so they read over the routes and
     the basemap's labels; a stripe in the traveler's color ties it to its dot. -->
{#each ways as way}
  {@const [x, y] = place(position(way.stages, way.minute).at)}
  <p class="tag" style:--c={way.color}
     style:transform={`translate(${(x + marker + 5).toFixed(1)}px,${(y + 6 * way.side).toFixed(1)}px)${way.side < 0 ? " translateY(-100%)" : ""}`}>
    <b>{way.label}</b>{doing(way)}
  </p>
{/each}
</div>

<style>
  .race {
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--fade-ms) ease;
  }

  .race.shown {
    opacity: 1;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
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

  circle.end {
    fill: var(--color-ground);
    stroke: var(--color-ground-text);
    stroke-width: 2;
  }

  circle.stop {
    fill: var(--color-ground);
    stroke: var(--color-pt);
    stroke-width: 2;
  }

  text.end,
  text.stop {
    fill: var(--color-ground-text);
    font: 500 12px var(--type-family);
    text-anchor: end;
    stroke: var(--color-ground);
    stroke-width: 3px;
    paint-order: stroke;
  }

  text.end {
    font-size: 13px;
    font-weight: 700;
  }

  .marker circle {
    stroke: var(--color-ground);
    stroke-width: 2.5;
  }

  /* In the map's ground color, so it reads as cut out of the dot. */
  .marker .icon {
    fill: none;
    stroke: var(--color-ground);
    stroke-width: 2.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tag {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    margin: 0;
    padding: 3px 8px 4px 7px;
    border-left: 3px solid var(--c);
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-ground) 88%, transparent);
    color: var(--color-ground-text);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.35;
    white-space: nowrap;
  }

  .tag b {
    font-size: 13px;
    font-weight: 700;
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
      transform: scale(2);
    }
  }
</style>
