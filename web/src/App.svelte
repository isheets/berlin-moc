<script>
  import story from "./content/story.yaml";
  import { loadData } from "./lib/data.js";
  import Story from "./story/Story.svelte";

  const loading = loadData();
</script>

{#await loading}
  <p class="status">Loading…</p>
{:then data}
  <Story {story} {data} />
{:catch error}
  <p class="status">The data could not be loaded: {error.message}</p>
{/await}

<style>
  .status {
    padding: var(--gutter);
    color: var(--color-muted);
  }
</style>
