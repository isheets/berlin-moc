<script>
  import { onMount } from "svelte";
  import { addLayers, applyState, createMap, setInteractive } from "./layers.js";
  import { states } from "./states.js";

  /** data: the loaded results; stateName: a key of states.js; interactive: explore mode */
  let { data, stateName, interactive = false } = $props();

  let container;
  let map = $state.raw(null);

  onMount(() => {
    const instance = createMap(container);
    instance.on("load", () => {
      addLayers(instance, data);
      map = instance;
    });
    return () => instance.remove();
  });

  // In explore mode the reader owns the camera: it moves only when the view itself changes.
  let camera = null;
  $effect(() => {
    if (!map) return;
    const next = states[stateName]?.camera;
    applyState(map, data, stateName, !interactive || next !== camera);
    camera = next;
  });

  $effect(() => {
    if (map) setInteractive(map, interactive);
  });
</script>

<div class="map" bind:this={container} aria-hidden={!interactive}></div>

<style>
  .map {
    position: fixed;
    inset: 0;
    background: var(--color-paper);
  }
</style>
