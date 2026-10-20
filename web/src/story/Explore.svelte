<script>
  import RatioKey from "../keys/RatioKey.svelte";
  import { paragraphs } from "../lib/text.js";

  /** Explore mode. Stage D fills it with layers, area cards, and the method; for now the map is
   *  free to pan and zoom, with the ratio map's key, and the way back to the story is here. */
  let { explore, text, data, values, keys, back } = $props();
</script>

<aside class="panel" aria-labelledby="explore-title">
  <header>
    <p class="kicker">Explore</p>
    <h2 id="explore-title">{explore.label}</h2>
  </header>
  <div class="body">
    {#each paragraphs(explore.text) as paragraph}<p>{@html text(paragraph)}</p>{/each}
    <RatioKey {data} {values} {text} words={keys.ratio} />
  </div>
  <footer>
    <button type="button" class="back" onclick={back}>‹ {explore.back}</button>
  </footer>
</aside>

<style>
  .panel {
    position: fixed;
    bottom: var(--gutter);
    left: var(--gutter);
    z-index: 2;
    width: var(--card-width);
    max-height: calc(100vh - 2 * var(--gutter));
    overflow-y: auto;
    border-radius: var(--radius);
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08), 0 10px 36px rgb(0 0 0 / 0.08);
  }

  header {
    padding: 18px 24px 10px;
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
    font-size: 1.3rem;
  }

  .body {
    padding: 14px 24px;
    color: var(--color-ink-secondary);
  }

  footer {
    padding: 10px 16px;
    border-top: 1px solid var(--color-hairline);
  }

  footer button {
    padding: 8px 16px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-ink-secondary);
    font-weight: 600;
    cursor: pointer;
  }

  :global(.phone) .panel {
    right: var(--phone-gutter);
    bottom: var(--phone-gutter);
    left: var(--phone-gutter);
    width: auto;
    max-height: var(--phone-panel-height);
  }
</style>
