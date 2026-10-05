<script>
  /** A row of mutually exclusive buttons: options [{value, label}], the chosen value bound. */
  let { options, value = $bindable(), label } = $props();
</script>

<div class="toggle" role="group" aria-label={label}>
  {#each options as option}
    <button type="button" aria-pressed={value === option.value} onclick={() => (value = option.value)}>
      {option.label}
    </button>
  {/each}
</div>

<style>
  .toggle {
    display: flex;
    margin-bottom: 12px;
    padding: 2px;
    border-radius: 999px;
    background: var(--color-paper);
  }

  button {
    flex: 1;
    padding: 6px 10px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
    cursor: pointer;
  }

  [aria-pressed="true"] {
    background: var(--color-accent);
    color: white;
  }
</style>
