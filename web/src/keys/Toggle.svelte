<script>
  /** A row of mutually exclusive buttons: options [{value, label}], the chosen value bound. A
   *  raised thumb slides under the chosen one; the others lift on hover. */
  let { options, value = $bindable(), label } = $props();

  const chosen = $derived(Math.max(0, options.findIndex((option) => option.value === value)));
</script>

<div class="toggle" role="group" aria-label={label} style:--count={options.length}>
  <span class="thumb" style:transform={`translateX(${chosen * 100}%)`} aria-hidden="true"></span>
  {#each options as option}
    <button type="button" aria-pressed={value === option.value} onclick={() => (value = option.value)}>
      {option.label}
    </button>
  {/each}
</div>

<style>
  .toggle {
    position: relative;
    display: flex;
    margin-bottom: 14px;
    padding: 3px;
    border: 1px solid var(--color-hairline);
    border-radius: 999px;
    background: var(--color-paper);
    box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.06);
  }

  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px) / var(--count));
    border-radius: 999px;
    background: var(--color-accent);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2), 0 2px 6px rgb(0 0 0 / 0.12);
    transition: transform 220ms ease;
  }

  button {
    position: relative;
    flex: 1;
    padding: 7px 12px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
    cursor: pointer;
    transition: color 220ms, background 150ms;
  }

  button:not([aria-pressed="true"]):hover {
    background: rgb(0 0 0 / 0.05);
    color: var(--color-ink);
  }

  [aria-pressed="true"] {
    color: white;
  }
</style>
