<script>
  /** The sections, down the right edge: where the reader is, and a way to jump. Explore mode sits
   *  apart below them, since it is not a step of the story. */
  let { sections, active, goSection, explore, exploring, goExplore } = $props();
</script>

<nav class="rail" aria-label="Sections">
  {#each sections as section}
    <button type="button" class:active={active === section.id}
            aria-current={active === section.id ? "true" : undefined}
            onclick={() => goSection(section.id)}>
      <span class="label">{section.rail}</span>
      <span class="dot"></span>
    </button>
  {/each}
  <button type="button" class="explore" class:active={exploring}
          aria-current={exploring ? "true" : undefined} onclick={goExplore}>
    <span class="label">{explore.label}</span>
    <span class="dot square"></span>
  </button>
</nav>

<style>
  .rail {
    position: fixed;
    top: 50%;
    right: 18px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    transform: translateY(-50%);
  }

  button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 0;
    border: 0;
    background: none;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    cursor: pointer;
  }

  .explore {
    margin-top: 14px;
  }

  .label {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgb(255 255 255 / 0.8);
    opacity: 0;
    transition: opacity var(--fade-ms);
  }

  .rail:hover .label,
  .active .label {
    opacity: 1;
  }

  .dot {
    width: 10px;
    height: 10px;
    border: 2px solid var(--color-muted);
    border-radius: 50%;
    background: var(--color-paper);
  }

  .dot.square {
    border-radius: 2px;
  }

  .active {
    color: var(--color-ink);
  }

  .active .dot {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  :global(.phone) .rail {
    display: none;
  }
</style>
