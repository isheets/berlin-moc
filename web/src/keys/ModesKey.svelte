<script>
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import Waffle from "./Waffle.svelte";

  /** The trips-by-mode key: care trips and work commutes as waffles, a square per `per` trips a
   *  weekday, by car, public transport and active modes; the car's block first. Each is a button
   *  that shows its group on the map. */
  let { words, text, values } = $props();

  const MODES = ["car", "pt", "other"];
  const row = (group) => ({
    key: group, label: words.groups[group],
    sub: `${formats.thousand(values[group].per_weekday)} ${words.perWeekday}`,
    shares: values[group].modes, total: values[group].per_weekday,
  });
</script>

<p class="title">{@html text(words.title)}</p>
<Waffle rows={[row("care"), row("commute")]} per={words.per}
        categories={MODES.map((key) => ({ key, label: words.modes[key] }))}
        selected={view.group} select={(group) => (view.group = group)} unit={text(words.unit)} />

<style>
  .title {
    margin: 0 0 6px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }
</style>
