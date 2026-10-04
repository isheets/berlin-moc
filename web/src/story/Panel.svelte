<script>
  import { fly } from "svelte/transition";
  import { motion } from "../config/theme.js";
  import CardSlot from "../cards/CardSlot.svelte";

  /** One section of the story: its title, where the reader is in it, the open point, and the
   *  controls. On the last point, Next becomes the way into explore mode. */
  let { sections, section, active, direction, text, ui, explore, last, next, back, jump, goExplore } = $props();

  const number = $derived(sections.indexOf(section) + 1);
  const point = $derived(section.points[active]);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slide = $derived({ x: reduced ? 0 : 40 * direction, duration: reduced ? 0 : motion.slideMs });
</script>

<aside class="panel" aria-labelledby="section-title">
  <header>
    <p class="kicker">{number} / {sections.length} · {section.rail}</p>
    <h2 id="section-title">{@html text(section.title)}</h2>
    {#if section.points.length > 1}
      <div class="progress">
        <ol aria-label="Points in this section">
          {#each section.points as item, i}
            <li>
              <button type="button" class:current={i === active} class:done={i < active}
                      aria-label={`Point ${i + 1} of ${section.points.length}`}
                      aria-current={i === active ? "step" : undefined} onclick={() => jump(i)}></button>
            </li>
          {/each}
        </ol>
        <span class="count">{active + 1} / {section.points.length}</span>
      </div>
    {/if}
  </header>

  <div class="body">
    {#key point.id}
      <article in:fly={slide}>
        <h3>{@html text(point.headline)}</h3>
        {#if point.text}
          <p>{@html text(point.text)}</p>
        {/if}
        {#if point.bullets}
          <ul>
            {#each point.bullets as bullet}
              <li>{@html text(bullet)}</li>
            {/each}
          </ul>
        {/if}
        {#each point.cards ?? [] as card}
          <CardSlot name={card} />
        {/each}
        {#if point.footnote}
          <p class="footnote">{@html text(point.footnote)}</p>
        {/if}
      </article>
    {/key}
  </div>

  <footer>
    <button type="button" class="back" onclick={back}>‹ {ui.back}</button>
    {#if last}
      <button type="button" class="next" title={explore.text} onclick={goExplore}>{explore.label} ›</button>
    {:else}
      <button type="button" class="next" onclick={next}>{ui.next} ›</button>
    {/if}
  </footer>
</aside>

<style>
  /* A fixed frame, so Back and Next never move; only the point between them scrolls. */
  .panel {
    position: fixed;
    top: var(--gutter);
    bottom: calc(var(--gutter) + var(--legend-height) + 12px);   /* the legend sits below */
    left: var(--gutter);
    z-index: 2;
    display: flex;
    flex-direction: column;
    width: var(--card-width);
    border-radius: var(--radius);
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08), 0 10px 36px rgb(0 0 0 / 0.08);
  }

  header {
    padding: 20px 24px 14px;
    border-bottom: 1px solid var(--color-hairline);
  }

  .kicker {
    margin: 0 0 4px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: var(--type-step-headline);
    line-height: 1.25;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
  }

  .progress ol {
    display: flex;
    flex: 1;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .progress li {
    flex: 1;
  }

  .progress button {
    display: block;
    width: 100%;
    height: 4px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: var(--color-hairline);
    cursor: pointer;
  }

  .progress .done {
    background: var(--color-muted);
  }

  .progress .current {
    background: var(--color-accent);
  }

  .count {
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-variant-numeric: tabular-nums;
  }

  .body {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 18px 24px;
  }

  h3 {
    margin: 0 0 10px;
    font-size: 1.12rem;
    line-height: 1.3;
  }

  article p,
  article ul {
    margin: 0 0 12px;
  }

  article ul {
    padding-left: 20px;
  }

  .footnote {
    color: var(--color-muted);
    font-size: var(--type-small);
    line-height: 1.45;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--color-hairline);
  }

  footer button {
    padding: 8px 16px;
    border: 0;
    border-radius: 999px;
    background: none;
    font-weight: 600;
    cursor: pointer;
  }

  .back {
    color: var(--color-ink-secondary);
  }

  .next {
    background: var(--color-accent);
    color: white;
  }

  :global(.phone) .panel {
    top: auto;
    right: var(--phone-gutter);
    bottom: var(--phone-gutter);
    left: var(--phone-gutter);
    width: auto;
    height: var(--phone-panel-height);
  }

  :global(.phone) header {
    padding: 14px 16px 10px;
  }

  :global(.phone) .body {
    padding: 12px 16px;
  }
</style>
