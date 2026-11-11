<script>
  /** What a mark stands for, shown beside the marks themselves: a waffle's square, the map's dot.
   *  items: [{shape: "square" or "dot", label (html)}]. */
  let { items } = $props();
</script>

<p class="scale">
  {#each items as item}
    <span><i class={item.shape} aria-hidden="true"></i>= {@html item.label}</span>
  {/each}
</p>

<style>
  .scale {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 24px;
    margin: 10px 0 0;
    color: var(--color-ink-secondary);
    font-size: 0.9rem;
    font-weight: 600;
  }

  span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  i {
    flex: none;
    background: var(--color-ink-secondary);
  }

  .square {
    width: 13px;
    height: 13px;
    border-radius: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
</style>
