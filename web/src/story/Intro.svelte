<script>
  /** The intro, the story's first step: the headline, the story in four lines, each labeled with its
   *  step, and the links. */
  let { intro, steps, text, goStep, goExplore } = $props();

  const label = (id) => steps.find((step) => step.id === id)?.label ?? "";
</script>

<h1 id="point-title">{@html text(intro.headline)}</h1>
{#if intro.lead}
  <p class="lead">{@html text(intro.lead)}</p>
{/if}
<dl class="lines">
  {#each intro.lines as line}
    <dt>{label(line.step)}</dt>
    <dd>{@html text(line.text)}</dd>
  {/each}
</dl>
<nav class="links">
  {#each intro.links.filter((link) => goExplore || !link.explore) as link}
    {#if link.explore}
      <button type="button" onclick={goExplore}>{link.label}</button>
    {:else if link.step}
      <button type="button" onclick={() => goStep(link.step)}>{link.label}</button>
    {:else}
      <a href={link.href} target="_blank" rel="noopener">{link.label}</a>
    {/if}
  {/each}
</nav>
<p class="byline">{intro.byline}</p>

<style>
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

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin-bottom: 10px;
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

  :global(.phone) .lines {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  :global(.phone) dd {
    margin-bottom: 10px;
  }
</style>
