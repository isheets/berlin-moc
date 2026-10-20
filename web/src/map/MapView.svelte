<script>
  import { onMount } from "svelte";
  import { view } from "../lib/view.svelte.js";
  import { addLayers, applyState, createMap, onZoneHover, setInteractive } from "./layers.js";
  import { placement } from "../lib/explainer.svelte.js";
  import { routePoints } from "../lib/race.js";
  import { createOverlay } from "./overlay.js";
  import Race from "./Race.svelte";
  import { resolve } from "./states.js";
  import Tooltip from "./Tooltip.svelte";

  /** data: the loaded results; stateName: a key of states.js, shown for the reader's view;
   *  exploring: explore mode, where the arrow keys move the map; words: story.yaml's `tooltip`;
   *  race: step 2's example trip as a race (race.js raceOf), and raceWords its words
   *  (story.yaml `explainer`) */
  let { data, stateName, exploring = false, words, race = null, raceWords } = $props();

  // The trip is framed right of the explainer's drawer.
  const route = $derived(race ? { points: routePoints(race), left: placement().right } : null);

  let container;
  let map = $state.raw(null);
  let overlay = null;
  let hovered = $state(null);

  onMount(() => {
    const instance = createMap(container);
    instance.on("load", () => {
      addLayers(instance, data);
      overlay = createOverlay(instance, data);
      onZoneHover(instance, (properties, point) => (hovered = properties ? { properties, point } : null));
      map = instance;
    });
    return () => {
      overlay?.remove();
      instance.remove();
    };
  });

  const state = $derived(resolve(stateName, view));

  // The reader can pan and zoom; each new step frames the city again, while a control that
  // recolors the map leaves the camera where the reader put it.
  let shown = null;
  $effect(() => {
    if (!map) return;
    applyState(map, state, stateName !== shown, route);
    overlay.setState(state);
    shown = stateName;
  });

  $effect(() => {
    if (map) setInteractive(map, exploring);
  });
</script>

<div class="map" bind:this={container}></div>
{#if map && race}
  <Race {map} {race} shown={!!state?.race} words={raceWords} />
{/if}
{#if hovered && state?.zones && !state.zones.dim}
  <Tooltip {...hovered} zones={state.zones} {words} />
{/if}

<style>
  .map {
    position: fixed;
    inset: 0;
    background: var(--color-ground);
  }

  /* "Berlin" (layers.js sets its size), with a halo like the basemap's labels. */
  .map :global(.city-label) {
    font-family: var(--type-family);
    font-weight: 700;
    color: var(--color-ground-text);
    -webkit-text-stroke: 3px var(--color-ground);
    paint-order: stroke fill;
    pointer-events: none;
    white-space: nowrap;
  }

  /* Its text fades in and out with the state (layers.js), easing in and out like the basemap's
     label fading the other way. */
  .map :global(.city-label span) {
    transition: opacity var(--fade-ms) ease-in-out;
  }
</style>
