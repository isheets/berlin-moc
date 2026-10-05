<script>
  import { colors } from "../config/theme.js";
  import { view } from "../lib/view.svelte.js";
  import DotBars from "./DotBars.svelte";

  /** The 10-minute network's key: care trips and commutes by the minutes it saves them, the
   *  lines it adds trips to, and the mean saving by stage. The shares are the dots' own. */
  let { data, words, text } = $props();

  const layer = $derived(data.dots.layers.saved);
  const CATEGORIES = ["unchanged", "saved_1", "saved_3", "saved_5"];
  const row = (group) => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    for (const code of layer.groups[group]) if (code !== ".") counts[layer.categories[code]] += 1;
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return { key: group, label: words.groups[group],
             shares: Object.fromEntries(CATEGORIES.map((c) => [c, counts[c] / total])) };
  };
</script>

<p class="title">{@html text(words.title)}</p>
<DotBars rows={[row("care"), row("commute")]} keyBelow
         categories={CATEGORIES.map((key) => ({ key, label: words.categories[key] }))}
         selected={view.group} select={(group) => (view.group = group)} unit={text(words.unit)} />
<p class="lines"><i style:background={colors.networkLines}></i><span>{@html text(words.lines)}</span></p>
<p class="mean">{@html text(words.mean)}</p>

<style>
  .title {
    margin: 0 0 6px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .lines {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }

  .lines i {
    flex: none;
    width: 16px;
    height: 2px;
    border-radius: 1px;
  }

  .mean {
    margin: 10px 0 0;
    padding-top: 8px;
    border-top: 1px solid var(--color-hairline);
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }
</style>
