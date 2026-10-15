<script>
  import { onMount } from "svelte";
  import { view } from "../lib/view.svelte.js";
  import { addLayers, applyState, createMap, firstLabel, onZoneHover, setInteractive } from "./layers.js";
  import { createOverlay } from "./overlay.js";
  import { resolve } from "./states.js";
  import Tooltip from "./Tooltip.svelte";

  /** data: the loaded results; stateName: a key of states.js, shown for the reader's view;
   *  exploring: explore mode, where the arrow keys move the map; words: story.yaml's `tooltip` */
  let { data, stateName, exploring = false, words } = $props();

  let container;
  let map = $state.raw(null);
  let overlay = null;
  let hovered = $state(null);

  onMount(() => {
    const instance = createMap(container);
    instance.on("load", () => {
      addLayers(instance, data);
      overlay = createOverlay(instance, data, firstLabel(instance));
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
    applyState(map, state, stateName !== shown);
    overlay.setState(state);
    shown = stateName;
  });

  $effect(() => {
    if (map) setInteractive(map, exploring);
  });
</script>

<div class="map" bind:this={container}></div>
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
</style>
