<script>
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import Waffle from "./Waffle.svelte";

  /** The walk key: care trips and commutes with a public transport route, each a bar the full
   *  width, split by whether the walk to and from stops alone takes as long as the whole trip by
   *  car, with that share written on it. Only the shares matter here, so unlike step 1's waffles,
   *  the bars don't show how many trips each group has. Each row shows its group on the map. */
  let { words, text, values } = $props();

  const CATEGORIES = ["walk_longer", "rest"];
  const row = (group) => ({
    key: group, label: words.groups[group],
    sub: `${formats.thousand(values[group].routed_per_weekday)} ${words.perWeekday}`,
    shares: { walk_longer: values[group].walk_alone, rest: 1 - values[group].walk_alone },
    onBar: { walk_longer: formats.pct(values[group].walk_alone) },
  });
</script>

<p class="title">{@html text(words.title)}</p>
<Waffle rows={[row("care"), row("commute")]}
        categories={CATEGORIES.map((key) => ({ key, label: words.categories[key] }))}
        selected={view.group} select={(group) => (view.group = group)} unit={text(words.unit)} />

<style>
  .title {
    margin: 0 0 6px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }
</style>
