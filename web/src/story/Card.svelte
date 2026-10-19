<script>
  import { fly } from "svelte/transition";
  import { motion } from "../config/theme.js";
  import DistanceKey from "../keys/DistanceKey.svelte";
  import FasterKey from "../keys/FasterKey.svelte";
  import ModesKey from "../keys/ModesKey.svelte";
  import RatioKey from "../keys/RatioKey.svelte";
  import WalkingKey from "../keys/WalkingKey.svelte";
  import Intro from "./Intro.svelte";

  /** The story's one card, the height of the screen. Its header stays put from step to step: the
   *  story's name, the sources, and a mark per step. Below it each step slides in: the intro,
   *  then a claim, how to read the map, and the key that works it. Back and Next stay put at the
   *  bottom; the intro has Start for Next, and on the last step Next leads into explore mode, if
   *  there is one (`goExplore`). */
  let { title, points, position, direction, text, ui, keys, data, values, explore, next, back, jump,
        goStep, goExplore, openSources } = $props();

  const KEYS = { modes: ModesKey, ratio: RatioKey, distance: DistanceKey, walking: WalkingKey,
                 faster: FasterKey };
  const point = $derived(points[position]);
  const Key = $derived(KEYS[point.key]);
  const last = $derived(position === points.length - 1);
  const plain = (source) => text(source).replace(/<[^>]+>/g, "");

  const slide = $derived({ x: 40 * direction, duration: motion.slideMs });
</script>

<aside class="card" aria-labelledby="point-title">
  <header>
    <p class="title">{title}</p>
    <button type="button" class="sources" onclick={openSources}>{ui.sources}</button>
  </header>
  <nav class="progress" aria-label="Story progress">
    <ol>
      {#each points as p, i}
        <li>
          <button type="button" class:done={i < position} class:current={i === position}
                  title={`${p.label} ${plain(p.headline)}`} aria-label={p.label}
                  aria-current={i === position ? "step" : undefined} onclick={() => jump(i)}></button>
        </li>
      {/each}
    </ol>
  </nav>

  <div class="body">
    {#key point.id}
      <article in:fly={slide}>
        {#if position === 0}
          <Intro intro={point} steps={points.slice(1)} {text} {goStep} {goExplore} />
        {:else}
          <h2 id="point-title">{@html text(point.headline)}</h2>
          {#if point.text}
            <p class="text">{@html text(point.text)}</p>
          {/if}
          {#if Key}
            <div class="key">
              <Key {data} {values} {text} words={keys[point.key]} />
            </div>
          {/if}
        {/if}
      </article>
    {/key}
  </div>

  <footer>
    {#if position > 0}
      <button type="button" class="back" onclick={back}>‹ {ui.back}</button>
    {/if}
    {#if !last}
      <button type="button" class="next" onclick={next}>{position === 0 ? point.start : ui.next} ›</button>
    {:else if goExplore}
      <button type="button" class="next" title={explore.text} onclick={goExplore}>{explore.label} ›</button>
    {/if}
  </footer>
</aside>

<style>
  /* The gutter all round, so the header and Back and Next never move. */
  .card {
    position: fixed;
    top: var(--gutter);
    bottom: var(--gutter);
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
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 28px 0;
  }

  .title {
    margin: 0;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sources {
    flex: none;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .sources:hover {
    color: var(--color-ink);
  }

  .progress {
    padding: 12px 28px 0;
  }

  ol {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
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

  .progress button.done {
    background: var(--color-muted);
  }

  .progress button.current {
    background: var(--color-accent);
  }

  .body {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 20px 28px 22px;
  }

  h2 {
    margin: 0 0 12px;
    font-size: 1.35rem;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .text {
    margin: 0 0 22px;
    color: var(--color-ink-secondary);
  }

  .key {
    margin-bottom: 18px;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
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

  /* On the right even without Back. */
  .next {
    margin-left: auto;
    background: var(--color-accent);
    color: white;
  }

  :global(.phone) .card {
    top: auto;
    right: var(--phone-gutter);
    bottom: var(--phone-gutter);
    left: var(--phone-gutter);
    width: auto;
    height: var(--phone-panel-height);
  }

  :global(.phone) header {
    padding: 12px 16px 0;
  }

  :global(.phone) .progress {
    padding: 8px 16px 0;
  }

  :global(.phone) .body {
    padding: 12px 16px;
  }

  :global(.phone) h2 {
    font-size: 1.15rem;
  }
</style>
