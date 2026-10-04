<script>
  /** Explore mode. Stage D fills it with layers, area cards, and the deep dives; for now the map
   *  is free to pan and zoom, and the way back to the story is here. */
  let { explore, text, back } = $props();
</script>

<aside class="panel" aria-labelledby="explore-title">
  <header>
    <p class="kicker">Explore</p>
    <h2 id="explore-title">{explore.label}</h2>
  </header>
  <div class="body">
    <p>{@html text(explore.text)}</p>
    <p class="note">Layers, area cards, and the deep dives come in stage D. Until then, the map pans and zooms.</p>
  </div>
  <footer>
    <button type="button" class="back" onclick={back}>‹ {explore.back}</button>
  </footer>
</aside>

<style>
  .panel {
    position: fixed;
    top: var(--gutter);
    left: var(--gutter);
    z-index: 2;
    width: var(--card-width);
    border-radius: var(--radius);
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08), 0 10px 36px rgb(0 0 0 / 0.08);
  }

  header {
    padding: 20px 24px 12px;
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
  }

  .body {
    padding: 14px 24px 4px;
  }

  .note {
    color: var(--color-muted);
    font-size: var(--type-small);
  }

  footer {
    padding: 10px 16px 14px;
  }

  .back {
    padding: 8px 16px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-ink-secondary);
    font-weight: 600;
    cursor: pointer;
  }

  :global(.phone) .panel {
    top: auto;
    right: var(--phone-gutter);
    bottom: var(--phone-gutter);
    left: var(--phone-gutter);
    width: auto;
  }
</style>
