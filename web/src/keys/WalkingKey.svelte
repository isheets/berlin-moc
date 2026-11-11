<script>
  import ShareKey from "./ShareKey.svelte";

  /** The walk key: of each group's trips with a public transport route, the share whose walk to,
   *  between and from stops takes as long as the whole trip by car, overall as bars and by area on
   *  the map. A share, not a count: care trips are more, so counts would show more of them
   *  anyway. */
  let { words, text, values } = $props();
</script>

<ShareKey {words} {text} category="walk_longer" ramp="walkShare"
          share={(group) => values[group].walk_alone} total={(group) => values[group].routed_per_weekday} />
