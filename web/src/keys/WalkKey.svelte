<script>
  import { colors } from "../config/theme.js";

  /** The closing key: the typical care trip's walking legs, glowing on the map. */
  let { words, text } = $props();
</script>

<p class="key"><span class="glow" style:background={colors.walk}></span>{@html text(words.walk)}</p>

<style>
  .key {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }

  .glow {
    width: 22px;
    height: 6px;
    border-radius: 3px;
    animation: glow 1.4s ease-in-out infinite alternate;
  }

  @keyframes glow {
    from { opacity: 0.35; }
    to { opacity: 1; }
  }
</style>
