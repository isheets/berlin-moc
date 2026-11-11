<script>
  import { colors } from "../config/theme.js";
  import { formats } from "../lib/text.js";
  import { view } from "../lib/view.svelte.js";
  import Ramp from "./Ramp.svelte";
  import Waffle from "./Waffle.svelte";

  /** A share's key: care trips and commutes as bars the full width, split by whether a trip is in
   *  `category`, with that share written on it, each a button that shows its group on the map.
   *  Then the map's legend: the share by area on `ramp`, both groups' shares marked on it (the
   *  one shown in bold), and the areas with too few trips. share(group) and total(group) read
   *  each group's share and its trips a weekday. labels: the categories' names, if not
   *  words.categories; control: a snippet that names `category` in its place, with a control. */
  let { words, text, category, share, total, ramp, orMore = false, labels = words.categories,
        control } = $props();

  const GROUPS = ["care", "commute"];
  const row = (group) => ({
    key: group, label: words.groups[group],
    sub: `${formats.thousand(total(group))} ${words.perWeekday}`,
    shares: { [category]: share(group), rest: 1 - share(group) },
    onBar: { [category]: formats.pct(share(group)) },
  });
  const markers = $derived(GROUPS.map((group) => ({
    value: share(group), label: `${words.groups[group]} ${formats.pct(share(group))}`,
    color: colors[`${group}Text`], strong: view.group === group,
  })));
</script>

<Waffle rows={GROUPS.map(row)}
        categories={[category, "rest"].map((key) => ({ key, label: labels[key],
                                                       control: key === category ? control : undefined }))}
        selected={view.group} select={(group) => (view.group = group)} />
<p class="title">{@html text(words.map)}</p>
<Ramp {ramp} {markers} {orMore} />
<p class="key"><span class="swatch" style:background={colors.noData}></span>{@html text(words.noData)}</p>

<style>
  .title {
    margin: 22px 0 2px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .key {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 0 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
  }

  .swatch {
    width: 14px;
    height: 10px;
    border-radius: 2px;
  }
</style>
