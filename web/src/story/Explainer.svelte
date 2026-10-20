<script>
  import { fly } from "svelte/transition";
  import { colors, layout, motion } from "../config/theme.js";
  import { explainer, finish, minuteOf, placement, run } from "../lib/explainer.svelte.js";
  import { apportion, formats, paragraphs } from "../lib/text.js";

  /** Step 2's side quest, in a drawer beside the card: what public transport competitiveness is,
   *  through one care trip, stage by stage, each started by the reader where its result appears.
   *  The trip by car, then by public transport: each runs on the map, saying there what the
   *  traveler is doing, and fills a bar split into walking, waiting or parking, and riding or
   *  driving. Then the two times as a ratio, on a scale where 1× is the same time, and why it
   *  matters. A stage opens once the one before has started, and starting it skips what's left
   *  of that one; until then it waits, greyed. It closes from ✕, Escape (Story.svelte), the
   *  dimmed card (Card.svelte), or "Got it" at the end. words: story.yaml's `explainer`; race:
   *  the trip's ways (race.js raceOf); close: closes it. */
  let { words, text, values, race, close } = $props();

  const total = (way) => race.minutes[way];
  const minute = (way) => minuteOf(way, total(way));
  const arrived = (way) => explainer.runs[way] != null && minute(way) >= total(way);

  // The runs' clock, ticked while one moves; a new run starts it again.
  $effect(() => {
    const { car, pt } = explainer.runs;
    if (car == null && pt == null) return;
    let frame;
    const tick = (t) => {
      explainer.now = t;
      const moving = ["car", "pt"].some((way) => explainer.runs[way] != null && minute(way) < total(way));
      if (moving) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  // The two ways, on one minute scale: public transport's time spans the track.
  const ways = $derived([
    { way: "car", n: 1, stages: race.car, color: colors.car, open: true },
    { way: "pt", n: 2, stages: race.pt, color: colors.pt, open: explainer.runs.car != null },
  ]);
  const at = (minutes) => `${(minutes / race.minutes.pt) * 100}%`;

  /** Starts a way's run, the car's first finished if it's still on its way. */
  function start(way) {
    if (way === "pt" && !arrived("car")) finish("car", total("car"));
    run(way);
  }

  function compare() {
    for (const way of ["car", "pt"]) if (!arrived(way)) finish(way, total(way));
    explainer.compared = true;
  }

  /** A way's whole minutes by kind of stage (walking, waiting or parking, riding or driving),
   *  adding up to its whole minutes door to door. */
  function parts(stages, way) {
    const minutes = {};
    for (const stage of stages) minutes[stage.kind] = (minutes[stage.kind] ?? 0) + stage.end - stage.start;
    const shares = Object.fromEntries(Object.entries(minutes).map(([kind, m]) => [kind, m / total(way)]));
    return Object.entries(apportion(shares, Math.round(total(way)))).filter(([, m]) => m > 0);
  }

  // The ratio scale, 0 to 4×.
  const TICKS = [0, 1, 2, 3, 4];
  const along = (value) => `${(Math.min(Math.max(value, 0), 4) / 4) * 100}%`;

  const caret = $derived(explainer.anchor - layout.gutter);
  const focus = (node, on = true) => on && node.focus({ preventScroll: true });
</script>

<div class="explainer" role="dialog" aria-modal="true" aria-labelledby="explainer-title"
     style:left={`${placement().left}px`} style:width={`${layout.drawerWidth}px`}
     style:--caret={`${caret}px`} transition:fly={{ x: -40, duration: motion.drawerMs }}>
  <header>
    <h2 id="explainer-title">{words.title}</h2>
    <button type="button" class="close" aria-label={words.close} onclick={close}>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" /></svg>
    </button>
  </header>

  <div class="body">
    <div class="lead paragraphs">
      {#each paragraphs(words.lead) as paragraph}<p>{@html text(paragraph)}</p>{/each}
    </div>
    <div class="example paragraphs">
      {#each paragraphs(words.example) as paragraph}<p>{@html text(paragraph)}</p>{/each}
    </div>

    <!-- 1 and 2: each way, run by the reader, as a bar filling on the shared scale. -->
    {#each ways as { way, n, stages, color, open }}
      {@const stage = words.stages[way]}
      {@const ran = explainer.runs[way] != null}
      <section class="stage" class:locked={!open}>
        <h3><span class="n">{n}</span>{stage.title}
          {#if ran}<b class="minutes" class:there={arrived(way)}>{Math.round(minute(way))} {words.min}</b>{/if}
        </h3>
        <div class="track" style:--c={color}>
          {#each stages as part}
            {#if ran && minute(way) > part.start}
              <i class={`part ${part.kind}`} style:left={at(part.start)}
                 style:width={at(Math.min(minute(way), part.end) - part.start)}></i>
            {/if}
          {/each}
          {#if !ran}
            <button type="button" class="play" disabled={!open} use:focus={way === "car"}
                    onclick={() => start(way)}>
              <svg viewBox="0 0 10 12" aria-hidden="true"><path d="M1 1l8 5-8 5z" /></svg>{stage.run}
            </button>
          {/if}
        </div>
        <p class="now">
          {#if arrived(way)}
            {#each parts(stages, way) as [kind, m]}
              <span class="key"><i class={`swatch ${kind}`} style:--c={color}></i>{m} {stage.parts[kind]}</span>
            {/each}
            <button type="button" class="again" aria-label={stage.again} title={stage.again}
                    onclick={() => run(way)}>
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M10 6a4 4 0 1 1-1.2-2.8M10 1.5v2.7H7.3" /></svg>
            </button>
          {/if}
        </p>
      </section>
    {/each}

    <!-- 3: the ratio, on a scale, and why it matters. -->
    <section class="stage" class:locked={explainer.runs.pt == null}>
      {#if explainer.compared}
        <h3><span class="n">3</span>{words.compare.title}</h3>
        <div class="ratio" in:fly={{ y: 6, duration: 300 }}>
          <span class="fraction">
            <b>{formats.min(race.minutes.pt)} {words.min}</b><i></i><b>{formats.min(race.minutes.car)} {words.min}</b>
          </span>
          <span class="equals">=</span>
          <b class="result">{formats.x(values.example.ratio)}</b>
          <span class="over">{words.compare.over}</span>
        </div>
        <div class="scale" aria-hidden="true">
          <div class="marks">
            <span class="same" style:left={along(1)}>{words.compare.same}</span>
            <span class="slower" style:left={along(2.6)}>{words.compare.slower} →</span>
          </div>
          <div class="axis">
            {#each TICKS as tick}<span class="tick" class:one={tick === 1} style:left={along(tick)}></span>{/each}
            <span class="dot" style:left={along(values.example.ratio)}><em>{words.compare.thisTrip}</em></span>
          </div>
          <div class="numbers">
            {#each TICKS as tick}<span style:left={along(tick)}>{tick ? `${tick}×` : "0"}</span>{/each}
          </div>
        </div>
        <div class="text paragraphs">
          {#each paragraphs(words.compare.text) as paragraph}<p>{@html text(paragraph)}</p>{/each}
        </div>
      {:else}
        <button type="button" class="step" disabled={explainer.runs.pt == null} onclick={compare}>
          <span class="n">3</span>{words.compare.title}<span class="go">›</span>
        </button>
      {/if}
    </section>
  </div>

  {#if explainer.compared}
    <footer>
      <button type="button" class="done" use:focus onclick={close}>{words.done}</button>
    </footer>
  {/if}
</div>

<style>
  /* Beside the card, from the top gutter to the bottom one, with a caret toward the button. */
  .explainer {
    position: fixed;
    top: var(--gutter);
    bottom: var(--gutter);
    z-index: 2;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius);
    background: var(--color-card);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.1), 0 10px 36px rgb(0 0 0 / 0.2);
  }

  .explainer::before {
    content: "";
    position: absolute;
    top: calc(var(--caret) - 8px);
    left: -7px;
    width: 14px;
    height: 14px;
    border-radius: 2px;
    background: var(--color-card);
    transform: rotate(45deg);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 14px 4px 24px;
  }

  h2 {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .close {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    transition: background 150ms;
  }

  .close:hover {
    background: var(--color-paper);
  }

  .close svg {
    width: 12px;
    height: 12px;
    stroke: var(--color-ink);
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 24px 12px;
  }

  .lead {
    margin: 0 0 8px;
    color: var(--color-ink);
    font-size: 1rem;
  }

  .example {
    margin: 0 0 14px;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }

  /* A stage: its number and title, then what it shows. Greyed until the one before is done. */
  .stage {
    padding: 12px 0;
    border-top: 1px solid var(--color-hairline);
    transition: opacity 300ms;
  }

  .stage.locked {
    opacity: 0.4;
  }

  h3,
  .step {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 8px;
    font-size: 1rem;
    font-weight: 600;
  }

  .n {
    display: grid;
    flex: none;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-ink);
    color: white;
    font-size: var(--type-kicker);
    font-weight: 700;
  }

  .locked .n {
    background: var(--color-muted);
  }

  .minutes {
    margin-left: auto;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
    transition: color 200ms;
  }

  .minutes.there {
    color: var(--color-ink);
  }

  /* A stage that opens on a click: its heading as the button. */
  .step {
    width: 100%;
    margin: 0;
    padding: 8px 12px 8px 8px;
    border: 1px solid var(--color-muted);
    border-radius: 8px;
    background: none;
    color: var(--color-ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 150ms, background 150ms;
  }

  .step:hover:not(:disabled) {
    border-color: var(--color-ink);
    background: var(--color-paper);
  }

  .step:disabled {
    border-color: var(--color-hairline);
    cursor: default;
  }

  .go {
    margin-left: auto;
    font-size: 1.2rem;
    line-height: 1;
  }

  /* The way's bar: each part where it falls on the scale, moving parts in the way's color, walking
     lighter, waiting or parking striped. */
  .track {
    position: relative;
    height: 30px;
    border-radius: 4px;
    background: var(--color-paper);
  }

  .part,
  .swatch {
    background: var(--c);
  }

  .part {
    position: absolute;
    top: 0;
    bottom: 0;
  }

  .walk {
    opacity: 0.45;
  }

  .wait,
  .park {
    background: repeating-linear-gradient(135deg, var(--c) 0 2px, transparent 2px 5px);
  }

  .play {
    position: absolute;
    top: 3px;
    left: 3px;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 12px 0 10px;
    border: 0;
    border-radius: 999px;
    background: var(--color-accent);
    color: white;
    font: inherit;
    font-size: var(--type-small);
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms;
  }

  .play:hover:not(:disabled) {
    background: var(--color-ink);
  }

  .play:disabled {
    background: var(--color-muted);
    cursor: default;
  }

  .play svg {
    width: 9px;
    height: 11px;
    fill: currentColor;
  }

  /* Where the minutes went, once the traveler is there. */
  .now {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
    min-height: 24px;
    margin: 6px 0 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }

  .key {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  .again {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-left: auto;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }

  .again:hover {
    background: var(--color-paper);
  }

  .again svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: var(--color-ink-secondary);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* The ratio: public transport's minutes over the car's. */
  .ratio {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .fraction {
    display: grid;
    justify-items: center;
    gap: 3px;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .fraction i {
    width: 100%;
    height: 2px;
    background: var(--color-ink);
  }

  .equals {
    color: var(--color-muted);
    font-size: 1.4rem;
  }

  .result {
    font-family: var(--type-display);
    font-size: 2.2rem;
    font-weight: 700;
    line-height: 1;
  }

  .over {
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
    line-height: 1.3;
  }

  /* The scale, labels over it and numbers under, as on a ruler. */
  .scale {
    margin: 22px 8px 0;
  }

  .marks,
  .numbers {
    position: relative;
    height: 18px;
  }

  .marks span,
  .numbers span {
    position: absolute;
    bottom: 0;
    white-space: nowrap;
    transform: translateX(-50%);
  }

  .marks span {
    color: var(--color-ink-secondary);
    font-size: var(--type-kicker);
    font-weight: 600;
  }

  .marks .slower {
    color: var(--color-muted);
    font-weight: 500;
    transform: none;
  }

  .numbers span {
    top: 4px;
    color: var(--color-muted);
    font-size: var(--type-kicker);
    font-variant-numeric: tabular-nums;
  }

  .axis {
    position: relative;
    height: 2px;
    margin-top: 8px;
    background: var(--color-muted);
  }

  .axis .tick {
    position: absolute;
    top: -4px;
    width: 2px;
    height: 10px;
    margin-left: -1px;
    background: var(--color-muted);
  }

  /* The same time: dashed, up to its label. */
  .axis .tick.one {
    top: -10px;
    height: 16px;
    background: repeating-linear-gradient(var(--color-ink) 0 3px, transparent 3px 6px);
  }

  .dot {
    position: absolute;
    top: -6px;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    border: 2px solid var(--color-card);
    border-radius: 50%;
    background: var(--color-ink);
    animation: arrive 900ms ease both;
  }

  .dot em {
    position: absolute;
    bottom: 18px;
    left: 50%;
    color: var(--color-ink);
    font-size: var(--type-kicker);
    font-style: normal;
    font-weight: 700;
    white-space: nowrap;
    transform: translateX(-50%);
  }

  /* Sliding in from the same time to the trip's. */
  @keyframes arrive {
    from {
      left: 20%;
      opacity: 0;
    }
  }

  .text {
    margin: 12px 0 0;
    color: var(--color-ink-secondary);
    font-size: var(--type-small);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    padding: 12px 20px;
    border-top: 1px solid var(--color-hairline);
  }

  .done {
    padding: 7px 18px;
    border: 0;
    border-radius: 999px;
    background: var(--color-accent);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms;
  }

  .done:hover {
    background: var(--color-ink);
  }
</style>
