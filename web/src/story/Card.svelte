<script>
  import { fly } from "svelte/transition";
  import { motion } from "../config/theme.js";
  import DistanceKey from "../keys/DistanceKey.svelte";
  import ModesKey from "../keys/ModesKey.svelte";
  import RatioKey from "../keys/RatioKey.svelte";
  import FasterKey from "../keys/FasterKey.svelte";
  import WalkingKey from "../keys/WalkingKey.svelte";

  /** One step of the story: the claim, how to read the map, and the key that works it; Back and
   *  Next stay put at the bottom, and on the last step Next leads into explore mode, if there is
   *  one (`goExplore`). */
  let { steps, step, direction, text, ui, keys, data, values, explore, last, next, back, jump,
        goExplore } = $props();

  const KEYS = { modes: ModesKey, ratio: RatioKey, distance: DistanceKey, walking: WalkingKey,
                 faster: FasterKey };
  const Key = $derived(KEYS[step.key]);
  const here = $derived(steps.indexOf(step));

  // Steps sharing a label form one stretch of the progress bar.
  const stretches = $derived(steps.reduce((all, s, i) => {
    if (all.at(-1)?.label === s.label) all.at(-1).steps.push(i);
    else all.push({ label: s.label, steps: [i] });
    return all;
  }, []));

  const slide = $derived({ x: 40 * direction, duration: motion.slideMs });
</script>

<aside class="card" aria-labelledby="step-title">
  <nav class="progress" aria-label="Story progress">
    {#each stretches as stretch}
      <ol style:flex={stretch.steps.length}>
        {#each stretch.steps as i}
          <li>
            <button type="button" class:done={i < here} class:current={i === here}
                    title={`${steps[i].label} ${text(steps[i].headline).replace(/<[^>]+>/g, "")}`}
                    aria-label={steps[i].label} aria-current={i === here ? "step" : undefined}
                    onclick={() => jump(i)}></button>
          </li>
        {/each}
      </ol>
    {/each}
  </nav>

  <div class="body">
    {#key step.id}
      <article in:fly={slide}>
        <h2 id="step-title">{@html text(step.headline)}</h2>
        {#if step.text}
          <p class="text">{@html text(step.text)}</p>
        {/if}
        {#if Key}
          <div class="key">
            <Key {data} {values} {text} words={keys[step.key]} />
          </div>
        {/if}
      </article>
    {/key}
  </div>

  <footer>
    <button type="button" class="back" onclick={back}>‹ {ui.back}</button>
    {#if !last}
      <button type="button" class="next" onclick={next}>{ui.next} ›</button>
    {:else if goExplore}
      <button type="button" class="next" title={explore.text} onclick={goExplore}>{explore.label} ›</button>
    {/if}
  </footer>
</aside>

<style>
  /* Anchored bottom left and as tall as its step, so Back and Next never move. */
  .card {
    position: fixed;
    bottom: var(--gutter);
    left: var(--gutter);
    z-index: 2;
    display: flex;
    flex-direction: column;
    width: var(--card-width);
    max-height: calc(100vh - 2 * var(--gutter));
    border-radius: var(--radius);
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08), 0 10px 36px rgb(0 0 0 / 0.08);
  }

  .progress {
    display: flex;
    gap: 8px;
    padding: 20px 28px 0;
  }

  ol {
    display: flex;
    gap: 2px;
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

  .next {
    background: var(--color-accent);
    color: white;
  }

  :global(.phone) .card {
    right: var(--phone-gutter);
    bottom: var(--phone-gutter);
    left: var(--phone-gutter);
    width: auto;
    max-height: var(--phone-panel-height);
  }

  :global(.phone) .progress {
    padding: 12px 16px 0;
  }

  :global(.phone) .body {
    padding: 10px 16px 12px;
  }

  :global(.phone) h2 {
    font-size: 1.15rem;
  }
</style>
