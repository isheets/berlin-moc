<script>
  import Questions from "./Questions.svelte";

  /** The intro, the story's first step: the headline, the lead, the questions the steps ask (not
   *  their answers), and the links. */
  let { intro, steps, text, goStep, goExplore } = $props();
</script>

<h1 id="point-title">{@html text(intro.headline)}</h1>
{#if intro.lead}
  <p class="lead">{@html text(intro.lead)}</p>
{/if}
<p class="contents">{intro.contents}</p>
<Questions {steps} {text} />
<div class="meta">
  <p class="byline">{intro.byline}</p>
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
</div>

<style>
  h1 {
    margin: 0 0 12px;
    font-size: var(--type-hero-headline);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .lead {
    margin: 0 0 26px;
    color: var(--color-ink-secondary);
    font-size: 1.1rem;
  }

  .contents {
    margin: 0 0 12px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* The byline and the links on one line. */
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 18px;
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
</style>
