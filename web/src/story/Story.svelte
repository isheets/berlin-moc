<script>
  import { motion } from "../config/theme.js";
  import MapView from "../map/MapView.svelte";
  import { storyValues } from "../lib/data.js";
  import { numberCitations, render, storyTexts } from "../lib/text.js";
  import { resetView, view } from "../lib/view.svelte.js";
  import Card from "./Card.svelte";
  import Explore from "./Explore.svelte";
  import Intro from "./Intro.svelte";
  import Sources from "./Sources.svelte";

  let { story, data } = $props();

  const values = $derived(storyValues(data, story.activities));
  const citations = $derived(numberCitations(storyTexts(story)));
  const text = $derived((source) => render(source, values, citations));

  // The intro, then every step; the reader moves through them one at a time. Explore mode is not
  // a step: it is where the last step hands over.
  const points = $derived([{ id: "intro", map: story.intro.map }, ...story.steps]);

  let position = $state(0);
  let direction = $state(1);            // 1 stepping forward, -1 back: which way steps slide in
  let exploring = $state(false);
  let openSource = $state(null);        // the source the drawer highlights, "" for the whole list

  const current = $derived(points[position]);
  const mapState = $derived(exploring ? story.explore.map : current.map);

  // A step with a before/after control (story.yaml `demo`) flips it once by itself, unless the
  // reader has touched the control first.
  let demo = null;
  let touched = false;

  function enter(target) {
    position = target;
    exploring = false;
    resetView(points[target].view);
    touched = false;
    clearTimeout(demo);
    const step = points[target];
    if (step.demo) {
      demo = setTimeout(() => {
        if (!touched && points[position] === step) Object.assign(view, step.demo);
      }, motion.demoMs);
    }
  }

  function go(to) {
    const target = Math.max(0, Math.min(points.length - 1, to));
    direction = target >= position ? 1 : -1;
    enter(target);
    history.replaceState(null, "", `#${points[position].id}`);
  }

  function goExplore() {
    clearTimeout(demo);
    exploring = true;
    resetView(story.explore.view);
    history.replaceState(null, "", "#explore");
  }

  const goStep = (id) => go(points.findIndex((point) => point.id === id));

  function fromHash() {
    const hash = decodeURIComponent(location.hash);
    if (hash === "#explore") return goExplore();
    const at = points.findIndex((point) => `#${point.id}` === hash);
    enter(at >= 0 ? at : 0);
  }

  function onKey(event) {
    if (exploring || openSource !== null || event.target.closest?.("input, textarea, select")) return;
    if (["ArrowRight", "ArrowDown", "PageDown"].includes(event.key)) go(position + 1);
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) go(position - 1);
    else return;
    event.preventDefault();
  }

  /** Swiping the card sideways steps, like a photo gallery. */
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

  fromHash();
</script>

<svelte:window onkeydown={onKey} onhashchange={fromHash} />

<MapView {data} stateName={mapState} {exploring} words={story.tooltip} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="reader" use:swipe onclick={openCitation}>
  {#if exploring}
    <Explore explore={story.explore} {text} {data} {values} keys={story.keys}
             back={() => go(points.length - 1)} />
  {:else if position > 0}
    <Card
      steps={story.steps}
      step={current}
      {direction}
      {text}
      ui={story.ui}
      keys={story.keys}
      {data}
      {values}
      explore={story.explore}
      last={position === points.length - 1}
      next={() => go(position + 1)}
      back={() => go(position - 1)}
      jump={(i) => go(i + 1)}
      {goExplore}
      touch={() => (touched = true)}
    />
  {:else}
    <Intro intro={story.intro} steps={story.steps} {text} start={() => go(1)} {goStep} {goExplore} />
  {/if}
</div>

{#if !exploring}
  <button type="button" class="explore-link" onclick={goExplore}>{story.explore.label} ›</button>
{/if}
<button type="button" class="sources-link" onclick={() => (openSource = "")}>{story.ui.sources}</button>
<Sources sources={story.sources} {citations} {text} credits={data.summary.scenario.sources}
         creditLabels={story.credits?.labels} extraCredits={story.credits?.extra} bind:open={openSource} />

<style>
  .explore-link {
    position: fixed;
    top: var(--gutter);
    right: var(--gutter);
    z-index: 2;
    padding: 8px 14px;
    border: 0;
    border-radius: 999px;
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.1), 0 4px 14px rgb(0 0 0 / 0.08);
    color: var(--color-ink);
    font-size: var(--type-small);
    font-weight: 600;
    cursor: pointer;
  }

  .explore-link:hover {
    background: var(--color-paper);
  }

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

  :global(.phone) .explore-link {
    top: var(--phone-gutter);
    right: var(--phone-gutter);
  }

  :global(.phone) .sources-link {
    bottom: calc(var(--phone-panel-height) + 2 * var(--phone-gutter));
  }
</style>
