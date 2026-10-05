<script>
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import DotBars from "./DotBars.svelte";

  /** The minutes key: the time care trips and commutes would spend on public transport, by
   *  walking, waiting and riding. */
  let { data, words, text } = $props();

  const STAGES = { walk: "walk", wait: "wait", ride: "in_vehicle" };
  const row = (group) => {
    const minutes = data.summary.groups[group].networks.today.mean_minutes_by_stage.pt;
    const total = Object.values(STAGES).reduce((sum, stage) => sum + minutes[stage], 0);
    return {
      key: group, label: words.groups[group],
      sub: `${formats.min(total)} ${words.perTrip}`,
      shares: Object.fromEntries(Object.entries(STAGES).map(([key, stage]) => [key, minutes[stage] / total])),
    };
  };
</script>

<p class="title">{@html text(words.title)}</p>
<DotBars rows={[row("care"), row("commute")]}
         categories={Object.keys(STAGES).map((key) => ({ key, label: words.stages[key] }))}
         selected={view.group} select={(group) => (view.group = group)} unit={text(words.unit)} />

<style>
  .title {
    margin: 0 0 6px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }
</style>
