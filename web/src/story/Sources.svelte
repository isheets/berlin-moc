<script>
  import { tick } from "svelte";

  /** open: the id of the source to highlight, "" for none, or null when the drawer is closed */
  let { sources, citations, text, credits, creditLabels = {}, extraCredits = [], open = $bindable(null) } = $props();

  const cited = $derived([...citations]
    .map(([id, n]) => ({ n, ...sources.find((source) => source.id === id) }))
    .filter((source) => source.text));

  $effect(() => {
    if (open) tick().then(() => document.getElementById(`source-${open}`)?.scrollIntoView({ block: "nearest" }));
  });
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && (open = null)} />

{#if open !== null}
  <aside class="drawer" aria-label="Sources">
    <header>
      <h2>Sources</h2>
      <button type="button" class="close" onclick={() => (open = null)} aria-label="Close sources">×</button>
    </header>
    <ol>
      {#each cited as source}
        <li id="source-{source.id}" class:highlight={source.id === open} value={source.n}>
          {@html text(source.text)}
          {#if source.url}
            <a href={source.url} target="_blank" rel="noopener">Link</a>
          {/if}
        </li>
      {/each}
    </ol>
    <h2>Data</h2>
    <ul>
      {#each extraCredits as credit}
        <li>{@html text(credit)}</li>
      {/each}
      {#each Object.entries(credits) as [key, credit]}
        <li>
          {creditLabels[key] ?? key}: {credit.license}
          (<a href={credit.url} target="_blank" rel="noopener">source</a>)
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 3;
    width: min(420px, 100%);
    overflow-y: auto;
    padding: 20px 24px;
    background: white;
    box-shadow: -8px 0 32px rgb(0 0 0 / 0.12);
    font-size: var(--type-small);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: var(--type-step-headline);
  }

  .close {
    border: 0;
    background: none;
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
  }

  ol,
  ul {
    padding-left: 22px;
  }

  ul li {
    overflow-wrap: anywhere;
  }

  li {
    margin: 0 -10px 10px;
    padding: 8px 10px;
    border-radius: 6px;
  }

  .highlight {
    background: color-mix(in srgb, var(--color-pt) 12%, white);
  }

  :global(.phone) .drawer {
    top: auto;
    max-height: 60vh;
    border-radius: var(--radius) var(--radius) 0 0;
    box-shadow: 0 -8px 32px rgb(0 0 0 / 0.12);
  }
</style>
