<script>
  import { plainText } from "../lib/text.js";

  /** Steps as their questions, numbered: the intro's contents, which don't give the answers away,
   *  and the close's recap, each question over its answer (`answers`). Plain text: a term opens in
   *  its own step. */
  let { steps, text, answers = false } = $props();

  const plain = (source) => plainText(text(source));
</script>

<ol class="questions">
  {#each steps as step, i}
    <li>
      <span class="number" aria-hidden="true">{i + 1}</span>
      <span class="question">{plain(step.label)}
        {#if answers}<span class="answer">{plain(step.headline)}</span>{/if}</span>
    </li>
  {/each}
</ol>

<style>
  .questions {
    display: grid;
    gap: 10px;
    margin: 0 0 26px;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 26px 1fr;
    align-items: baseline;
  }

  .number {
    color: var(--color-accent);
    font-family: var(--type-display);
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1;
  }

  .question {
    color: var(--color-ink);
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .answer {
    display: block;
    margin-top: 2px;
    color: var(--color-ink-secondary);
    font-weight: 400;
  }
</style>
