<script>
  import MapView from "../map/MapView.svelte";
  import Legend from "../map/Legend.svelte";
  import { states } from "../map/states.js";
  import { storyValues } from "../lib/data.js";
  import { numberCitations, render, storyTexts } from "../lib/text.js";
  import Explore from "./Explore.svelte";
  import Intro from "./Intro.svelte";
  import Panel from "./Panel.svelte";
  import Rail from "./Rail.svelte";
  import Sources from "./Sources.svelte";

  let { story, data } = $props();

  const values = $derived(storyValues(data, story.activities));
  const citations = $derived(numberCitations(storyTexts(story)));
  const text = $derived((source) => render(source, values, citations));

  // Every point in reading order, the intro first; the reader steps through them one at a time.
  // Explore mode is not a step: it is where the last point hands over.
  const points = $derived([
    { id: "intro", map: story.intro.map },
    ...story.sections.flatMap((section, s) =>
      section.points.map((point, p) => ({ ...point, section, s, p }))),
  ]);

  let position = $state(0);
  let direction = $state(1);            // 1 stepping forward, -1 back: which way points slide in
  let exploring = $state(false);
  let comparing = $state(false);        // the legend's toggle: the `compare` map instead
  let openSource = $state(null);        // the source the drawer highlights, "" for the whole list

  const current = $derived(points[position]);
  const view = $derived(exploring ? story.explore : current);
  const mapState = $derived(comparing && view.compare ? view.compare : view.map);

  function go(to) {
    const target = Math.max(0, Math.min(points.length - 1, to));
    direction = target >= position ? 1 : -1;
    position = target;
    exploring = false;
    comparing = false;
    history.replaceState(null, "", `#${points[position].id}`);
  }

  function goExplore() {
    exploring = true;
    comparing = false;
    history.replaceState(null, "", "#explore");
  }

  const goSection = (id) => go(points.findIndex((point) => point.section?.id === id));
  const goPoint = (section, p) => go(points.findIndex((point) => point.section === section && point.p === p));

  function fromHash() {
    const hash = decodeURIComponent(location.hash);
    if (hash === "#explore") return goExplore();
    const at = points.findIndex((point) => `#${point.id}` === hash);
    if (at >= 0) position = at;
  }

  function onKey(event) {
    if (exploring || openSource !== null || event.target.closest?.("input, textarea, select")) return;
    if (["ArrowRight", "ArrowDown", "PageDown"].includes(event.key)) go(position + 1);
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) go(position - 1);
    else return;
    event.preventDefault();
  }

  /** Swiping the panel sideways steps, like a photo gallery. */
  function swipe(node) {
    let start = null;
    const down = (event) => (start = event.touches[0]);
    const up = (event) => {
      const end = event.changedTouches[0];
      const dx = start ? end.clientX - start.clientX : 0;
      if (!exploring && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(end.clientY - start.clientY)) {
        go(position + (dx < 0 ? 1 : -1));
      }
      start = null;
    };
    node.addEventListener("touchstart", down, { passive: true });
    node.addEventListener("touchend", up, { passive: true });
    return {
      destroy() {
        node.removeEventListener("touchstart", down);
        node.removeEventListener("touchend", up);
      },
    };
  }

  function openCitation(event) {
    const cite = event.target.closest(".cite");
    if (cite) openSource = cite.dataset.source;
  }

  $effect(fromHash);
</script>

<svelte:window onkeydown={onKey} onhashchange={fromHash} />

<MapView {data} stateName={mapState} interactive={exploring} />
{#if exploring || current.section}
  <Legend state={states[mapState]} words={story.legend} compare={view.compare} bind:comparing />
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="reader" use:swipe onclick={openCitation}>
  {#if exploring}
    <Explore explore={story.explore} {text} back={() => go(points.length - 1)} />
  {:else if current.section}
    <Panel
      sections={story.sections}
      section={current.section}
      active={current.p}
      {direction}
      {text}
      ui={story.ui}
      explore={story.explore}
      last={position === points.length - 1}
      next={() => go(position + 1)}
      back={() => go(position - 1)}
      jump={(p) => goPoint(current.section, p)}
      {goExplore}
    />
  {:else}
    <Intro intro={story.intro} sections={story.sections} {text} start={() => go(1)} {goSection} {goExplore} />
  {/if}
</div>

<Rail sections={story.sections} active={exploring ? null : current.section?.id} {goSection}
      explore={story.explore} {exploring} {goExplore} />
<button type="button" class="sources-link" onclick={() => (openSource = "")}>{story.ui.sources}</button>
<Sources sources={story.sources} {citations} {text} credits={data.summary.scenario.sources}
         creditLabels={story.credits?.labels} extraCredits={story.credits?.extra} bind:open={openSource} />

<style>
  /* Beside the map's own attribution, bottom right. */
  .sources-link {
    position: fixed;
    right: 10px;
    bottom: 34px;
    z-index: 2;
    padding: 2px 8px;
    border: 0;
    border-radius: 4px;
    background: rgb(255 255 255 / 0.8);
    color: var(--color-ink-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .sources-link:hover {
    text-decoration: underline;
  }

  :global(.phone) .sources-link {
    bottom: calc(var(--phone-panel-height) + 2 * var(--phone-gutter));
  }
</style>
