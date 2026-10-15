<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  /** A term's definition, by the term: shown on hover (after a moment, so passing over doesn't
   *  flash it) or focus, pinned open by a click or a tap, closed by Escape or a click elsewhere.
   *  While it shows, a scrim dims the page under it. terms: story.yaml's `terms`, each a text or
   *  {title, text (or a list of paragraphs), head, rows, note}; cite: opens a source. */
  let { terms, text, cite } = $props();

  let open = $state(null);         // {id, button, label, pinned}
  let width = $state(0);
  let height = $state(0);
  let hiding = null;
  let showing = null;

  const GAP = 10;
  const place = $derived.by(() => {
    if (!open) return null;
    const rect = open.button.getBoundingClientRect();
    const left = Math.max(GAP, Math.min(rect.left - 16, window.innerWidth - width - GAP));
    const above = rect.top - height - GAP;
    return { left, top: above >= GAP ? above : rect.bottom + GAP };
  });

  function show(button, pinned) {
    clearTimeout(hiding);
    clearTimeout(showing);
    if (open?.button !== button) open?.button.setAttribute("aria-expanded", "false");
    const label = button.textContent.trim();
    open = { id: button.dataset.term, button, pinned, label: label[0].toUpperCase() + label.slice(1) };
    button.setAttribute("aria-expanded", "true");
  }

  function hide() {
    clearTimeout(hiding);
    clearTimeout(showing);
    open?.button.setAttribute("aria-expanded", "false");
    open = null;
  }

  // Leaving the term for the definition keeps it open, as its citations can be clicked.
  const hideSoon = () => {
    clearTimeout(showing);
    clearTimeout(hiding);
    hiding = setTimeout(() => !open?.pinned && hide(), 200);
  };

  onMount(() => {
    const term = (event) => event.target.closest?.(".term");
    const over = (event) => {
      const button = term(event);
      if (event.pointerType !== "mouse" || !button || open?.pinned) return;
      clearTimeout(hiding);
      clearTimeout(showing);
      if (open) show(button, false);
      else showing = setTimeout(() => show(button, false), 150);
    };
    const out = (event) => {
      if (event.pointerType === "mouse" && term(event) && !open?.pinned) hideSoon();
    };
    const click = (event) => {
      const button = term(event);
      if (button) {
        if (open?.button === button && open.pinned) hide();
        else show(button, true);
      } else if (open && !event.target.closest?.(".term-popover")) hide();
    };
    const focus = (event) => term(event) && !open?.pinned && show(term(event), false);
    const blur = (event) => term(event) && !open?.pinned && hideSoon();
    const key = (event) => event.key === "Escape" && open && hide();
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("click", click);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("click", click);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", blur);
      document.removeEventListener("keydown", key);
    };
  });

  function onClick(event) {
    const source = event.target.closest(".cite");
    if (source) cite(source.dataset.source);
  }
</script>

{#if open && terms[open.id]}
  {@const term = typeof terms[open.id] === "string" ? { text: terms[open.id] } : terms[open.id]}
  <div class="scrim" transition:fade={{ duration: 150 }} aria-hidden="true"></div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="term-popover" role="tooltip" bind:offsetWidth={width} bind:offsetHeight={height}
       style:left={`${place.left}px`} style:top={`${place.top}px`} transition:fade={{ duration: 150 }}
       onpointerenter={() => clearTimeout(hiding)} onpointerleave={() => !open?.pinned && hideSoon()}
       onclick={onClick}>
    <p class="term-title">{term.title ?? open.label}</p>
    {#each [term.text].flat() as paragraph}
      <p class="definition">{@html text(paragraph)}</p>
    {/each}
    {#if term.rows}
      <table>
        {#if term.head}
          <thead><tr>{#each term.head as cell}<th scope="col">{@html text(cell)}</th>{/each}</tr></thead>
        {/if}
        <tbody>
          {#each term.rows as [label, value]}
            <tr><th scope="row">{@html text(label)}</th><td>{@html text(value)}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if term.note}<p class="definition note">{@html text(term.note)}</p>{/if}
  </div>
{/if}

<style>
  /* Dims the card and the map under the definition; the pointer passes through. */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 9;
    background: rgb(12 14 18 / 0.32);
    pointer-events: none;
  }

  .term-popover {
    position: fixed;
    z-index: 10;
    width: max-content;
    max-width: min(380px, calc(100vw - 20px));
    padding: 16px 18px 17px;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.16), 0 14px 40px rgb(0 0 0 / 0.22);
    font-weight: 400;
    letter-spacing: normal;
    text-align: left;
    text-transform: none;
  }

  .term-title {
    margin: 0 0 6px;
    color: var(--color-ink);
    font-family: var(--type-display);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .definition {
    margin: 0;
    color: var(--color-ink-secondary);
    font-size: 0.95rem;
    line-height: 1.55;
  }

  .definition + .definition {
    margin-top: 8px;
  }

  /* A definition's table: a label and its value per row. */
  table {
    width: 100%;
    margin: 8px 0 0;
    border-collapse: collapse;
    font-size: 0.92rem;
    font-variant-numeric: tabular-nums;
  }

  thead th {
    padding: 0 0 4px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-weight: 600;
    text-align: left;
  }

  thead th:last-child,
  td {
    text-align: right;
  }

  tbody th,
  td {
    padding: 4px 0;
    border-top: 1px solid var(--color-hairline);
  }

  tbody th {
    color: var(--color-ink-secondary);
    font-weight: 400;
    text-align: left;
  }

  td {
    color: var(--color-ink);
    font-weight: 600;
  }

  .note {
    margin-top: 10px;
    font-size: 0.85rem;
  }
</style>
