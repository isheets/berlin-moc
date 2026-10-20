# Planning

The story the page tells and the decisions behind it. This doc holds no copy or numbers:
- the copy is in [src/content/story.yaml](src/content/story.yaml);
- every number is in [../analysis/results/summary.json](../analysis/results/summary.json), which the
  page reads;
- the method and its caveats are in [../analysis/README.md](../analysis/README.md);
- colors, sizes and timings are in [src/config/theme.js](src/config/theme.js).

## The story

Care trips against commutes, for households with children in Berlin. Each step makes one claim,
and its map shows it.

1. **How common?** Care trips outnumber commutes and are driven more. The driven ones are the
   target; walked and cycled trips are fine as they are.
2. **How much longer?** Public transport is less competitive with the car for care trips than for
   commutes. A study in Norway motivates why competitiveness matters; it isn't our finding.
3. **Why: trip length.** Care trips are short, and public transport competes worst on short trips.
   At the same distance, most of the gap goes: a composition effect.
4. **Why: the walk.** On a short trip, the walk to and from stops alone can take as long as the
   whole drive.
5. **What if?** Berlin's 10-minute goal speeds up few trips, care trips and commutes alike.
6. **So what?** Closer, not only more often: an implication, not a tested scenario.

Steps 4 and 5 make separate claims. Don't tie them together ("little changes because of the
walk"): the data doesn't support it, and how frequency changes the walk needs more background than
the page has room for.

## Decisions

- **One source, MATSim,** so every number follows our definitions.
- **Households with children throughout,** with the commute as the benchmark in every step.
- **From step 2 on, only trips driven today.** It shows how far public transport is from competing
  for them, not how many drivers would switch. Trips made by public transport today aren't routed.
- **Trip length is driving distance.** Straight-line distance only sets the minimum, since it has to
  be known before routing.
- **No significance tests.** With this many trips everything tests significant, and MATSim reuses
  each diary for many residents, so trips aren't independent. Differences are judged by size,
  against the noise between areas; maps draw differences within that noise in a neutral gray.
- **No headline differences that a measure creates.** An effect that is small and alike for both
  groups is reported as that.
- **One minimum for every map:** an area needs `min_area_trips` (config.yaml) of a group's trips
  for any statistic or share.
- **Step 5's "faster" is the reader's cutoff** (`faster_by_min`): any one cutoff would be
  arbitrary, and the groups stay alike at each.

## The page

- The map tells every finding; there are no charts on their own. Each step is one card: a
  question, its answer, and a key holding the step's one control and its legend. The default view
  already shows the finding, and nothing tells the reader what to click.
- The data draws over the basemap's labels, so place names never sit on it.
- Each step's form follows its finding, not the components already built.
- Step 2 has a side quest on what public transport competitiveness is
  ([src/story/Explainer.svelte](src/story/Explainer.svelte)), from a button by its medians. It is
  a drawer beside the card, which slides mostly off screen, so the story reads as waiting where
  it was. The reader runs one care trip by car, then by public transport, then compares the
  times, each stage on a click. Lunke's study sits there, as it supports the method, not our
  findings. The trip is the care trip nearest the median on distance, ratio and walking's share.
- Terms open short definitions in place; sources sit in a drawer.
- Care trips come first, on the left of every legend, and each color keeps one meaning across
  steps.
- Explore mode is hidden for now (`EXPLORE` in [src/story/Story.svelte](src/story/Story.svelte)).

## Writing

On top of CLAUDE.md's rules: ratios with ":" or "vs.", never "÷", and no "minutes per 10 by car";
"care trips", never a bare "care"; "fare" only for tickets; a field term is defined once, at first
use; no claims about how public transport is planned.

## To do

- Copy pass, and a Method FAQ for the definitions to link to (parking, congestion, the 10-minute
  network), with sources.
- Point the intro's "Code" link at this repo.
- README: replace the caveat that volumes worth citing come from SrV with the single-source choice,
  and bring the `dots.json` row up to date.
- Deploy to GitHub Pages.
- Later: explore mode.
