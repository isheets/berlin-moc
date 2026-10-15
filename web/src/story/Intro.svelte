<script>
  /** The opening: the headline and the story in four lines, each labeled with its step. */
  let { intro, steps, text, start, goStep, goExplore } = $props();

  const label = (id) => steps.find((step) => step.id === id)?.label ?? "";
</script>

<aside class="intro" aria-labelledby="intro-title">
  <p class="kicker">{intro.kicker}</p>
  <h1 id="intro-title">{@html text(intro.headline)}</h1>
  {#if intro.lead}
    <p class="lead">{@html text(intro.lead)}</p>
  {/if}
  <dl class="lines">
    {#each intro.lines as line}
      <dt>{label(line.step)}</dt>
      <dd>{@html text(line.text)}</dd>
    {/each}
  </dl>
  <div class="actions">
    <button type="button" class="start" onclick={start}>{intro.start} ›</button>
    <nav class="links">
      {#each intro.links as link}
        {#if link.explore}
          <button type="button" onclick={goExplore}>{link.label}</button>
        {:else if link.step}
          <button type="button" onclick={() => goStep(link.step)}>{link.label}</button>
        {:else}
          <a href={link.href} target="_blank" rel="noopener">{link.label}</a>
        {/if}
      {/each}
    </nav>
  </div>
  <p class="byline">{intro.byline}</p>
</aside>

<style>
  .intro {
    position: fixed;
    top: 50%;
    left: var(--gutter);
    z-index: 2;
    width: min(620px, calc(100vw - 2 * var(--gutter)));
    max-height: calc(100vh - 2 * var(--gutter));
    overflow-y: auto;
    padding: 32px 36px 24px;
    border-radius: var(--radius);
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08), 0 10px 36px rgb(0 0 0 / 0.08);
    transform: translateY(-50%);
  }

  .kicker {
    margin: 0 0 12px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0 0 12px;
    font-size: var(--type-hero-headline);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .lead {
    margin: 0 0 24px;
    color: var(--color-ink-secondary);
  }

  .lines {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 14px 20px;
    margin: 0 0 26px;
  }

  dt {
    padding-top: 2px;
    color: var(--color-accent);
    font-size: var(--type-kicker);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 24px;
    margin-bottom: 16px;
  }

  .start {
    padding: 10px 22px;
    border: 0;
    border-radius: 999px;
    background: var(--color-accent);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    font-size: var(--type-small);
    font-weight: 600;
  }

  .links button {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .byline {
    margin: 0;
    color: var(--color-muted);
    font-size: var(--type-small);
  }

  :global(.phone) .intro {
    top: auto;
    right: var(--phone-gutter);
    bottom: var(--phone-gutter);
    left: var(--phone-gutter);
    width: auto;
    max-height: 72vh;
    padding: 20px 18px 16px;
    transform: none;
  }

  :global(.phone) .lines {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  :global(.phone) dd {
    margin-bottom: 10px;
  }
</style>
