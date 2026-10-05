<script>
  import { onMount } from "svelte";
  import { playback } from "../lib/playback.svelte.js";
  import { view } from "../lib/view.svelte.js";
  import { addLayers, applyState, createMap, onZoneHover, setInteractive, showTrips } from "./layers.js";
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

  // The reader can pan and zoom; each new step (or camera) frames the map again, while a control
  // that recolors it leaves the camera where the reader put it.
  let shown = null;
  let camera = null;
  $effect(() => {
    if (!map) return;
    const next = state?.camera;
    applyState(map, data, state, stateName !== shown || next !== camera);
    overlay.setState(state);
    shown = stateName;
    camera = next;
  });

  // Another typical trip: redraw its routes and frame it.
  let picked = null;
  $effect(() => {
    const now = `${playback.selected.care}|${playback.selected.commute}`;
    if (!map) return;
    if (picked !== null && picked !== now) {
      showTrips(map, data);
      applyState(map, data, state, true);
    }
    picked = now;
  });

  // The race is drawn from the clock; a restart has to wake the overlay.
  $effect(() => {
    playback.startedAt;
    overlay?.redraw();
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
</style>
