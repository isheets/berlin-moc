<script>
  import { view } from "../lib/view.svelte.js";
  import Toggle from "./Toggle.svelte";
  import TripRace from "./TripRace.svelte";

  /** The typical trip's key: which group's trip, and its time strips with Replay and Another. */
  let { data, words } = $props();
</script>

<Toggle options={["care", "commute"].map((g) => ({ value: g, label: words.groups[g] }))}
        bind:value={view.group} label={words.groups.care} />
<TripRace {data} group={view.group} {words} />
