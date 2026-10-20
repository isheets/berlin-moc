<script>
  import { fly } from "svelte/transition";
  import { motion } from "../config/theme.js";
  import DistanceKey from "../keys/DistanceKey.svelte";
  import FasterKey from "../keys/FasterKey.svelte";
  import ModesKey from "../keys/ModesKey.svelte";
  import RatioKey from "../keys/RatioKey.svelte";
  import WalkingKey from "../keys/WalkingKey.svelte";
  import { plainText } from "../lib/text.js";
  import Intro from "./Intro.svelte";
  import Questions from "./Questions.svelte";

  /** The story's one card, the height of the screen. Its header stays put from step to step: the
   *  story's name and the sources. Below it each step slides in: the intro, then each step's
   *  question, its answer, the key that works the map, a caption, and a note at the foot; the
   *  close recaps the questions before it. The footer stays put too: a mark per step, then Back
   *  and Next; the intro has Start for Next, and on the last step Next leads into explore mode,
   *  if there is one (`goExplore`). A step with `explainer` hands its key the button that opens
   *  the explainer (`explain`); while it's open (`aside`), the card is inert, dims under a veil
   *  that closes it on a click (`closeExplainer`), and slides left by `shift` px to make room. */
  let { title, points, position, direction, text, ui, keys, data, values, explore, next, back, jump,
        goStep, goExplore, openSources, explain = null, aside = false, shift = 0,
        closeExplainer = null } = $props();

  const KEYS = { modes: ModesKey, ratio: RatioKey, distance: DistanceKey, walking: WalkingKey,
                 faster: FasterKey };
  const point = $derived(points[position]);
  const Key = $derived(KEYS[point.key]);
  const last = $derived(position === points.length - 1);
  const plain = (source) => plainText(text(source));

  const slide = $derived({ x: 40 * direction, duration: motion.slideMs });
</script>

<aside class="card" aria-labelledby="point-title" inert={aside}
       style:transform={shift ? `translateX(${-shift}px)` : null}>
  <header>
    <p class="title">{title}</p>
    <button type="button" class="sources" onclick={openSources}>{ui.sources}</button>
  </header>

  <div class="body">
    {#key point.id}
      <article in:fly={slide}>
        {#if position === 0}
          <Intro intro={point} steps={points.slice(1)} {text} {goStep} {goExplore} />
        {:else}
          <h2 id="point-title">{@html text(point.label)}</h2>
          <p class="answer">{@html text(point.headline)}</p>
          {#if point.recap}
            <Questions steps={points.slice(1, position)} {text} answers />
          {/if}
          {#if Key}
            <div class="key">
              <Key {data} {values} {text} words={keys[point.key]}
                   explain={point.explainer ? explain : null} />
            </div>
          {/if}
          {#if point.text}
            <p class="text">{@html text(point.text)}</p>
          {/if}
          {#if point.note}
            <p class="note">{@html text(point.note)}</p>
          {/if}
        {/if}
      </article>
    {/key}
  </div>

  <footer>
    <nav class="progress" aria-label="Story progress">
      <ol>
        {#each points as p, i}
          <li>
            <button type="button" class:done={i < position} class:current={i === position}
                    title={`${plain(p.label)} ${plain(p.headline)}`} aria-label={plain(p.label)}
                    aria-current={i === position ? "step" : undefined} onclick={() => jump(i)}></button>
          </li>
        {/each}
      </ol>
    </nav>
    <div class="buttons">
      {#if position > 0}
        <button type="button" class="back" onclick={back}><span class="arrow">‹</span> {ui.back}</button>
      {/if}
      {#if !last}
        <button type="button" class="next" onclick={next}>{position === 0 ? point.start : ui.next}
          <span class="arrow">›</span></button>
      {:else if goExplore}
        <button type="button" class="next" title={explore.text} onclick={goExplore}>{explore.label}
          <span class="arrow">›</span></button>
      {/if}
    </div>
  </footer>
</aside>
<button type="button" class="veil" class:shown={aside} tabindex="-1" aria-hidden="true"
        style:transform={shift ? `translateX(${-shift}px)` : null} onclick={closeExplainer}></button>

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
    transition: transform var(--drawer-ms) ease;
  }

  /* Over the card while the explainer is open, moving with it: dims it, so the story reads as
     waiting where it was. */
  .veil {
    position: fixed;
    top: var(--gutter);
    bottom: var(--gutter);
    left: var(--gutter);
    z-index: 2;
    width: var(--card-width);
    padding: 0;
    border: 0;
    border-radius: var(--radius);
    background: rgb(18 18 18 / 0.35);
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
    transition: transform var(--drawer-ms) ease, opacity var(--drawer-ms);
  }

  .veil.shown {
    opacity: 1;
    pointer-events: auto;
  }

  /* The story's name as an eyebrow, the sources, and a hairline under them. */
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 28px 12px;
    border-bottom: 1px solid var(--color-hairline);
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

  /* Its marks line up with the text above. */
  .progress {
    padding: 0 8px 12px;
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
    height: 7px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: var(--color-hairline);
    cursor: pointer;
    transition: background 150ms, transform 150ms;
  }

  .progress button:hover {
    background: var(--color-muted);
    transform: scaleY(1.3);
  }

  .progress button.done {
    background: var(--color-muted);
  }

  .progress button.done:hover {
    background: var(--color-ink-secondary);
  }

  .progress button.current {
    background: var(--color-accent);
  }

  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 20px 28px 18px;
  }

  /* At least the body's full height, so the note can sit at its foot. */
  article {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
  }

  /* The question is the headline; the answer reads as its first line of text. */
  h2 {
    margin: 0 0 10px;
    font-size: 1.65rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .answer {
    margin: 0 0 22px;
    color: var(--color-ink);
    font-size: 1.05rem;
  }

  .key {
    margin-bottom: 14px;
  }

  /* Two lines high even when it takes one, so a longer caption moves nothing. */
  .text {
    min-height: 2lh;
    margin: 0 0 12px;
    color: var(--color-ink-secondary);
    font-size: 1rem;
  }

  /* Pinned to the foot of the body, however much is above it, just over the footer's rule. */
  .note {
    margin: auto 0 0;
    padding-top: 10px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
  }

  footer {
    padding: 14px 20px 12px;
    border-top: 1px solid var(--color-hairline);
  }

  .buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  footer button {
    padding: 7px 16px;
    border: 0;
    border-radius: 999px;
    background: none;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms, color 150ms;
  }

  .arrow {
    display: inline-block;
    transition: transform 150ms;
  }

  .back {
    color: var(--color-ink-secondary);
  }

  .back:hover {
    background: var(--color-paper);
    color: var(--color-ink);
  }

  .back:hover .arrow {
    transform: translateX(-3px);
  }

  /* On the right even without Back. */
  .next {
    margin-left: auto;
    background: var(--color-accent);
    color: white;
  }

  .next:hover {
    background: var(--color-ink);
  }

  .next:hover .arrow {
    transform: translateX(3px);
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
    padding: 0 0 10px;
  }

  :global(.phone) .body {
    padding: 12px 16px;
  }

  :global(.phone) h2 {
    font-size: 1.15rem;
  }
</style>
