<script>
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import Waffle from "./Waffle.svelte";

  /** The 10-minute network's key: care trips and commutes timed both today and with it, each a bar
   *  the full width, split by whether the network makes them a minute or more faster, with that
   *  share written on it. Each row shows its group on the map. */
  let { words, text, values } = $props();

  const CATEGORIES = ["faster", "rest"];
  const row = (group) => ({
    key: group, label: words.groups[group],
    sub: `${formats.thousand(values[group].paired_per_weekday)} ${words.perWeekday}`,
    shares: { faster: values[group].faster, rest: 1 - values[group].faster },
    onBar: { faster: formats.pct(values[group].faster) },
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
