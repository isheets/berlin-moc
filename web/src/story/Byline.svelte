<script>
  /** Who wrote the story and when, on the intro and the close. The name is a term that opens the
   *  email address. */
  let { byline, text } = $props();
</script>

<p class="byline">{@html text(byline)}</p>

<style>
  .byline {
    margin: 0;
    color: var(--color-muted);
    font-size: var(--type-small);
  }
</style>
