<script>
  import { colors } from "../config/theme.js";
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import Ramp from "./Ramp.svelte";
  import Toggle from "./Toggle.svelte";

  /** The ratio map's key: which group, the ramp with both groups' medians on it, and the dots:
   *  the trips where public transport is within 1.5× the car, the chosen group's share strong,
   *  the other's faint, as on the ramp. */
  let { words, text, values } = $props();

  const GROUPS = ["care", "commute"];
  const markers = $derived(GROUPS.map((group) => ({
    value: values[group].ratio,
    label: `${words.groups[group]} ${formats.x(values[group].ratio)}`,
    color: colors[group],
    strong: view.group === group,
  })));
</script>

<Toggle options={GROUPS.map((g) => ({ value: g, label: words.groups[g] }))}
        bind:value={view.group} label={words.title} />
<p class="title">{@html text(words.title)}</p>
<Ramp ramp="ratio" {markers} ticks={[1.5, 2.5]} />
<p class="key"><span class="swatch" style:background={colors.noData}></span>{@html text(words.noData)}</p>

<div class="within">
  <p class="name"><i style:background={colors.dots.within}></i>{@html text(words.within)}</p>
  <div class="shares" role="group" aria-label={words.within}>
    {#each GROUPS as group}
      <button type="button" class:strong={view.group === group} aria-pressed={view.group === group}
              onclick={() => (view.group = group)}>
        <b>{formats.pct(values[group].within_1_5)}</b> {words.of[group]}
      </button>
    {/each}
  </div>
  <p class="unit">{@html text(words.unit)}</p>
</div>
<p class="note">{@html text(words.lunke)}</p>

<style>
  .title {
    margin: 0 0 2px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .key {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0 12px;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
  }

  .swatch {
    width: 14px;
    height: 10px;
    border-radius: 2px;
  }

  .within {
    padding-top: 10px;
    border-top: 1px solid var(--color-hairline);
  }

  .name {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 4px;
    color: var(--color-ink);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .name i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .shares {
    display: flex;
    gap: 18px;
    margin-left: 17px;
  }

  .shares button {
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-muted);
    font-size: var(--type-small);
    cursor: pointer;
  }

  .shares b {
    font-size: 1.15rem;
  }

  .shares .strong {
    color: var(--color-ink);
  }

  .unit {
    margin: 6px 0 0 17px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
  }

  .note {
    margin: 10px 0 0;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    line-height: 1.4;
  }
</style>
