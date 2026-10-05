# Berlin showcase: planning

The story the page tells, and the decisions behind it. The visuals and UI/UX build on this.

## The one-minute story

**Short trips, long walks**

*How we compared.* We started from MATSim's synthetic Berlin, built from the 2018 travel survey,
and took every trip with both ends in the city, at least 500 m apart in a straight line:
- the care trips adults living with children drive, to or from a drop-off, a pick-up, or daily
  shopping;
- the same adults' drives to or from work with no care destination at either end, as the
  benchmark: the commute of step 1, driven.

Each trip is timed door to door at the hour it was made: by car with simulated congestion and
parking, and by public transport on the 2026 timetable.

1. **For adults living with children, trips to or from care destinations are as common as trips to
   or from work, and half as likely to go by public transport.**
   - A care destination is at one end of 42% of their trips, and work at one end of 39%. A trip
     between the two counts for both.
   - Public transport carries 17% of the care trips and 34% of the work trips. They drive 36% and
     30% of them.
2. **For the care trips driven today, public transport would take twice as long. For commutes, it
   would take 1.8 times as long.**
   - Every 10 minutes by car becomes 20 by public transport for a care trip, and 18 for a commute
     (medians).
   - For scale: in Norwegian cities, public transport drew 20% or more of commuters who could
     drive where it took at most 1.5 times as long as the car, given frequent service and at most
     one transfer. It drew 15–20% between 1.5 and 2.5 times, and under 5% beyond 3.5 times
     (Lunke et al. 2021).
   - 1 in 5 care trips is within 1.5 times, against nearly 3 in 10 commutes.
3. **Public transport is a little less competitive for care trips, mostly because they are shorter.**
   - A typical care trip is a 4.1 km drive, and a typical commute a 10.3 km drive. At the same
     driving distance, the gap is within about 0.1×.
   - On a short trip, the walk to and from the stop is a large part of the journey. A care trip by
     public transport spends 16 of its 33 minutes walking (47%); a commute spends 19 of 49 (39%).
     By car, both walk 2 to 2.5 minutes.
   - That walk is the hardest part with a child or the shopping.
4. **A bus every 10 minutes saves under a minute, for care trips and commutes alike.**
   - Running every bus and tram line at least every 10 minutes saves 0.7 minutes per trip on
     average for both. Relative to the car, care trips gain slightly more, but only because they
     are shorter: at the same distance the gain is nearly identical.
   - Most of the saving is walking: a nearby bus becomes frequent enough to take, in place of a
     walk to a farther line. Walking still takes 15 of a care trip's 32 minutes.
   - It matters most for the worst-served trips. The share taking over 3.5 times as long falls
     from 3.1% to 1.7% for care trips, and from 0.9% to 0.5% for commutes.

**Takeaways**
- To compete for care trips, public transport has to come closer, not only more often. This is an
  implication, not a tested scenario.
- Time is only part of it. Care trips mean escorting people and carrying things, which a time
  comparison does not measure.

**Limits**
- The trips are synthetic: real survey diaries placed on real streets by a model.
- Only trips driven today are timed. The comparison shows how far public transport is from
  competing for them, not how many drivers would switch.
- Everyone walks at an adult's pace; with a child, public transport's gap is larger.

## Dive deeper

- **Where?** By the area trips start in. Public transport is least competitive in the outer
  districts: Marzahn-Hellersdorf, Reinickendorf, Spandau, and Steglitz-Zehlendorf, at 2.17–2.26
  times as long. It's most competitive in Mitte, at 1.74.
- **When?** By departure hour. Evenings are least competitive (2.30 times from 19:00 to 21:00), and they gain
  most from the 10-minute network.
- **Which care trips?** Drop-offs and pick-ups (84%) and daily shopping (16%) behave alike. Trips
  aren't broken down by position in a chain, because MATSim places the stops synthetically.
- **Who?** Child poverty in the home area. Public transport is least competitive for the least-poor
  fifth, which gains most.
- **The 10-minute network:** 15% of care trips get faster, by a median of 4 minutes, mostly by
  walking less.
- **Method in full:** parking, congestion, the stop rules, and a ratio that counts the wait for
  the first departure.

## Decisions so far

- **One source, MATSim**, so every number follows our definitions.
- **A 500 m straight-line floor everywhere.** Below it public transport rarely competes, and
  walking carries most of the trips. Under 500 m fall 26% of escort trips and 44% of
  daily-shopping trips, against 2% of commutes.
- **To or from, for both care destinations and work.** A trip between the two counts as both.
- **Trip length as driving distance in the story.** Straight-line distance only sets the floor,
  because it has to be known before routing.
- **The commute as the benchmark in every beat**, so each number has a reference.
- **Lunke et al. as a scale, not a prediction.** The ratio belongs to the trip, so measuring it on
  driven trips is sound. Lunke's shares come from commuters who could drive, whichever mode they
  chose, and ours are drivers already.
- **No significance tests.**
  - With tens of thousands of trips per group, a naive test calls even a difference of a few
    seconds in minutes saved highly significant.
  - The trips aren't independent draws either: MATSim reuses each survey diary for many synthetic
    residents, so any such test overstates precision.
  - Differences are judged by size and at equal distance. At equal distance, care trips and
    commutes save about the same, to within a few seconds.
- **No routing of the trips made by public transport today.** Routing them would turn the second
  takeaway from a caveat into a finding, but the main story doesn't need it.
- **Wording:** "carries fewer", never "loses to the car"; "care destinations", never a bare
  "care"; no claims about how public transport is planned.

## To do

- README: replace the caveat that volumes come from SrV with the single-source choice, and say
  the floor applies to the counts too.
- Visuals: the distance figures use straight-line bands. Switch them to driving distance to match
  the story.
- Public repo: decide whether this doc is copied over with the rest of `analysis/`.

Numbers are from the run of 3 October 2026. The page will read them from `results/summary.json`.
