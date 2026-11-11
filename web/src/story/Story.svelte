<script>
  import MapView from "../map/MapView.svelte";
  import { exampleTrip, storyValues } from "../lib/data.js";
  import { closeExplainer, explainer, openExplainer, placement } from "../lib/explainer.svelte.js";
  import { raceOf } from "../lib/race.js";
  import { numberCitations, render, storyTexts } from "../lib/text.js";
  import { resetView } from "../lib/view.svelte.js";
  import Card from "./Card.svelte";
  import Explainer from "./Explainer.svelte";
  import Sources from "./Sources.svelte";
  import TermPopover from "./TermPopover.svelte";

  let { story, data } = $props();

  const values = $derived(storyValues(data));
  const citations = $derived(numberCitations(storyTexts(story)));
  const text = $derived((source) => render(source, values, citations, story.terms));

  // The intro, then every step; the reader moves through them one at a time, all in one card.
  const points = $derived([{ id: "intro", ...story.intro }, ...story.steps]);

  let position = $state(0);
  let direction = $state(1);            // 1 stepping forward, -1 back: which way steps slide in
  let openSource = $state(null);        // the source the drawer highlights, "" for the whole list

  const current = $derived(points[position]);

  // Step 2's explainer of public transport competitiveness, a drawer laid on the card; the map
  // shows its example trip from the first run until a moment after it closes (explainer.map).
  const race = $derived.by(() => {
    const trip = exampleTrip(data.typical);
    return trip ? raceOf(trip) : null;
  });
  const mapState = $derived(explainer.map ? "race" : current.map);

  function enter(target) {
    closeExplainer();
    position = target;
    resetView(points[target].view);
  }

  function go(to) {
    const target = Math.max(0, Math.min(points.length - 1, to));
    direction = target >= position ? 1 : -1;
    enter(target);
    history.replaceState(null, "", `#${points[position].id}`);
  }

  const goStep = (id) => go(points.findIndex((point) => point.id === id));

  function fromHash() {
    const hash = decodeURIComponent(location.hash);
    const at = points.findIndex((point) => `#${point.id}` === hash);
    enter(at >= 0 ? at : 0);
  }

  function onKey(event) {
    if (openSource !== null || event.target.closest?.("input, textarea, select")) return;
    if (explainer.open) {
      if (event.key === "Escape") closeExplainer();
      return;
    }
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
      if (!explainer.open && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(end.clientY - start.clientY)) {
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

<MapView {data} stateName={mapState} words={story.tooltip} {race} raceWords={story.explainer} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="reader" use:swipe onclick={openCitation}>
  <Card
    title={story.title}
    {points}
    {position}
    {direction}
    {text}
    ui={story.ui}
    keys={story.keys}
    {data}
    {values}
    next={() => go(position + 1)}
    back={() => go(position - 1)}
    jump={go}
    {goStep}
    openSources={() => (openSource = "")}
    explain={race ? openExplainer : null}
    aside={explainer.open}
    scale={explainer.open ? placement().scale : 1}
    {closeExplainer}
  />
  {#if explainer.open && race}
    <Explainer words={story.explainer} {text} {values} {race} close={closeExplainer} />
  {/if}
</div>

<TermPopover terms={story.terms} {text} cite={(id) => (openSource = id)} />
<Sources sources={story.sources} {citations} {text} credits={data.summary.scenario.sources}
         creditLabels={story.credits?.labels} extraCredits={story.credits?.extra} bind:open={openSource} />
