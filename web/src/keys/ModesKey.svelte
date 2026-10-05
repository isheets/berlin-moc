<script>
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import DotBars from "./DotBars.svelte";

  /** The trips-by-mode key: care trips and commutes, by public transport against the car. */
  let { words, text, values } = $props();

  const row = (key, from) => ({
    key, label: words.groups[key], sub: `${formats.thousand(values[from].car_or_pt)} ${words.perWeekday}`,
    shares: { pt: values[from].pt_vs_car, car: 1 - values[from].pt_vs_car },
  });
</script>

<p class="title">{@html text(words.title)}</p>
<DotBars rows={[row("care", "care"), row("commute", "work")]}
         categories={[{ key: "pt", label: words.modes.pt }, { key: "car", label: words.modes.car }]}
         selected={view.group} select={(group) => (view.group = group)} unit={text(words.unit)} />

<style>
  .title {
    margin: 0 0 6px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }
</style>
