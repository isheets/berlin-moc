# Care trips and a bus every 10 minutes

Escorting children and buying the household's groceries are care trips: the travel that unpaid
care work requires (Sánchez de Madariaga 2013). Public transport networks are planned around the
commute, and Lunke et al. (2021) expect them to serve other purposes less well, without testing it.
This analysis tests it for Berlin, and asks what a bus or tram every 10 minutes would change. It
compares public transport with the car for trips made by car today:

- **Care trips**: adults living with children, driving to or from a drop-off, a pick-up or daily
  shopping
- **Commutes**: the same adults driving to or from work, with no drop-off, pick-up or daily
  shopping at either end: the benchmark

## Method

**Trips.** Every trip of these kinds by a Berlin resident in the 25% synthetic population of
[MATSim Open Berlin v7.0](https://github.com/matsim-scenarios/matsim-berlin/tree/v7.0), whose
travel diaries come from Berlin's 2018 household travel survey (Monday to Thursday). Both ends
inside Berlin and at least 0.5 km apart in a straight line. A care trip has a care activity at
either end (Dianin et al. 2026), so the trip on from a drop-off to work counts too. "Living with
children" is the survey's household type. MATSim matches each diary to a synthetic resident by
age, gender, employment and region type only, so the trips show what Berliners' trips are like,
not where any one respondent lives. The plans give leisure, shopping and dining stops a duration
but no clock time; their departures are rebuilt from the previous departure and the diary's
travel time. `data/matsim-trip-counts.csv` counts every trip by a resident, by purpose, mode and
traveler.

**Networks.** *Today* is the official VBB timetable for Tuesday 6 October 2026. The *10-minute
network* is a simplified frequency floor inspired by the 2019 local transport plan's goal: the same
timetable with trips added wherever a BVG bus or tram line's regular service leaves a gap longer
than 10 minutes between 6:00 and 21:00. Each added trip copies the line's nearest trip on the same
stops, shifted in time. It is not the plan: no official timetable exists for it, and its cost is
not considered.

**Public transport time.** Door to door, from the diary departure time to arrival, waiting
included, on the earliest-arriving itinerary found within an hour of departure. An itinerary
counts only if it walks less than walking all the way; a trip with none has **no PT service**.
Everyone walks at the all-ages average of 4.82 km/h (Bosina & Weidmann 2017).

**Car time.** The drive, with the congestion MATSim simulates on each road in that hour, plus each
end of the trip. Each drop-off or pick-up is either a curbside stop of a minute (von Bartheld et
al. 2011) or one where the driver parks and goes in, assigned at random in the proportions SrV
2018 reports for whom escort trips serve. The driver goes in for someone going to a Kita
(daycare, 49.0%), a doctor or public office (3.6%), or a service such as a post office, bank or
hairdresser (1.0%). Every other escort ends at the curb, and trips with another purpose (4.0%) are
split in proportion: 56% parked, 44% curbside. A parked end means walking between the door and the
car, plus finding a space on arrival: the mean search time and walk measured by GPS for that
purpose in the start2park project, from 71 m and 1.2 minutes for shopping to 124 m and 1.5 minutes
for work (Hagen & Saki 2023). At home only cars kept on the street pay either: 70% in the inner
city and 49% outside it, the rest parking privately (SrV 2023, Hubrich et al. 2025). Work ends are
assumed to have no employer space. A route that never drives is **no car trip**.

**Compared.** The ratio of public transport time to car time: 1 means as fast as the car, 2 twice
as slow. Trips are grouped by the bands within which Lunke et al. (2021) found public transport's
share of car-available commuters falling step by step: up to 1.5, 1.5 to 2.5, 2.5 to 3.5, over 3.5.
Their ratio leaves out the wait for the first departure, so ours is the stricter. The change is the
same trip's public transport time on the 10-minute network minus today.

**Where people live.** Home planning areas (LOR 2021) are split into five equal groups by child
poverty: the share of under-15s living on basic income support (SGB II), from the city's social
monitoring (MSS 2025).

Every setting is in [config.yaml](config.yaml); OTP's in [otp/README.md](otp/README.md).

## Results

| File | Contents |
| --- | --- |
| `results/summary.json` | Headline numbers per group: competitiveness on each network, the change, by hour, district, child-poverty quintile and driving distance, and care trips by kind; trip counts by purpose; what the 10-minute network adds |
| `results/trips.csv` | One row per trip: areas, driving distance, PT time on each network, car time, ratios |
| `results/zones.geojson` | Planning areas with each group's statistics, for the trips that start there, and the gaps between the groups: in median ratio, and in the share of time the 10-minute network saves (which needs `min_share_trips`) |
| `results/network.geojson` | The lines the 10-minute network adds trips to, and the residential blocks it brings near a line every 10 minutes or leaves without one |
| `results/districts.geojson`, `results/trip-lines.json` | District outlines, and a random sample of each group's trips as straight lines with their driving-distance band, for the web page's map |
| `results/dots.json` | The page's dot-density layers, on places they share (a dot per `dots.trips` trips a weekday, or for shares the same density everywhere, spread over the inhabited blocks of the planning area trips start in): trips by public transport, driving, or any other mode, from every care and work trip counted by origin area and mode in `data/matsim-mode-counts.csv` (`mode_counts` in config.yaml, written by the extraction); whether walking is more than half the compared trips' time by public transport; and the compared trips by driving distance |
| `results/typical-trips.json` | Each group's typical trips, within 5 percentile points of its median on driving distance, ratio and walking share, with the route of every leg |
| `results/figures/` | Static versions of the main views |
| `results/routes/` | Every routed trip: the chosen itinerary by PT on each network, and by car |

## Running

Needs Python 3.11 or later and Java 21 (for OpenTripPlanner).

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m pipeline fetch          # timetable, streets, planning areas, population, OTP
python -m pipeline prepare        # trip sets and counts, the 10-minute timetable
python -m pipeline run            # graphs, routing (hours), results, map layers, typical trips
python -m pipeline run --sample 300   # a quick check into sample/
```

Downloads go to `downloads/`, intermediate files to `generated/`. Routing starts and stops
OpenTripPlanner on each network by itself (12 GB of memory) and resumes if interrupted. The
MATSim extracts in `data/` are committed; `prepare` rebuilds them all when one is missing, in one
pass over the plans, and the link times from several GB of simulation events. VBB replaces its timetable twice a week, so a later download fails the checksum in
`config.yaml`; the committed routes let the results be rebuilt without it.

## Caveats

- The trips are synthetic: real survey diaries placed on real locations by a model.
- The diaries are from 2018; the timetable from 2026.
- Car times use congestion from MATSim's calibrated simulation, not measured traffic. The published
  simulation predates the published plans.
- Parking times were measured mostly in Frankfurt; no Berlin measurement is published.
- The 10-minute network is a scenario, not a plan: no official timetable exists for it.
- The plans do not say whom an escort served or who traveled together. Errands and visits are left
  out for that reason, and strollers and carried shopping are not modeled.
- A parent walking with a young child is slower, since under-10s average 3.17 km/h. For escort
  trips, public transport times are therefore if anything too short, and the gap to the car too
  small.
- Trip counts from the synthetic population are background; volumes worth citing come from SrV's
  published tables.

## Sources

| Data | Source | License |
| --- | --- | --- |
| Trips, link travel times | MATSim Open Berlin v7.0, VSP TU Berlin | CC BY 4.0 |
| Timetable | [VBB GTFS](https://unternehmen.vbb.de/digitale-services/datensaetze/), published 29 September 2026 | CC BY 4.0 |
| Streets | OpenStreetMap, Geofabrik extract of 1 January 2026 | ODbL |
| Planning areas | LOR 2021, Geoportal Berlin | dl-de/by-2-0 |
| Population | Einwohnerdichte 2025 (Umweltatlas), Amt für Statistik Berlin-Brandenburg | CC BY 3.0 DE |
| Child poverty | Monitoring Soziale Stadtentwicklung 2025, indicator S4, Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen | dl-de/zero-2-0 |
| Neighbourhoods, inner city | ALKIS Ortsteile; Landschaftsprogramm, Gesamtstädtische Ausgleichskonzeption (the SrV's inner-city boundary), Geoportal Berlin | dl-de/zero-2-0 |
| The 10-minute goal | Nahverkehrsplan Berlin 2019–2023; draft Nahverkehrsplan 2026–2028, Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt | |
| Walking speeds | Bosina, E. & Weidmann, U. (2017). Estimating pedestrian speed using aggregated literature data. *Physica A* 468, 1–29 | |
| Curbside stops | von Bartheld, N. R., Budhecha, S. K. & von Bartheld, C. S. (2011). Directing traffic to increase passenger drop-off capacity. *Transportation Research Record* 2213, 72–77 | |
| Care trips | Dianin, A., Ceccato, R. & Diana, M. (2026). Mobility of care in daily trip chaining: an exploratory analysis in Turin, Italy. *Journal of Urban Mobility* 9, 100208 | |
| Whom escort trips serve | Gerike, R., Hubrich, S., Ließke, F., Wittig, S. & Wittwer, R. (2019). *Tabellenbericht zum Forschungsprojekt „Mobilität in Städten – SrV 2018" in Berlin*. TU Dresden, Tab. 5.1.4 | |
| Parking search and walk | Hagen, T. & Saki, S. (2023). *start2park – Parksuche erfassen, verstehen und prognostizieren: Endergebnisse*. Frankfurt University of Applied Sciences, Tables 5 and 17 | |
| Parking at home | Hubrich, S., Wittig, S., Ließke, F., Wittwer, R. & Gerike, R. (2025). *Tabellenbericht zum Forschungsprojekt „Mobilität in Städten – SrV 2023“ in Berlin (Innere Stadt; Äußere Stadt)*. TU Dresden, Tab. 4.2 | |
| Ratio bands | Lunke, E. B., Fearnley, N. & Aarhaug, J. (2021). Public transport competitiveness vs. the car: impact of relative journey time and service attributes. *Research in Transportation Economics* 90, 101098 | |
| Mobility of care | Sánchez de Madariaga, I. (2013). Mobility of care: introducing new concepts in urban transport. In *Fair Shared Cities*, 33–48 | |
