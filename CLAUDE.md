# CLAUDE.md

A portfolio project. It compares public transport with the car for care trips in Berlin (the
mobility of care), using the commute as the benchmark and MATSim Open Berlin's synthetic trips. It
also asks what a bus or tram every 10 minutes would change. The repo is public, and the web app is
published with GitHub Pages.

| Path | What it is |
| --- | --- |
| [analysis/](analysis/) | The pipeline, data, and results. For setup and run order, see [analysis/README.md](analysis/README.md) |
| [web/](web/) | The web app. [web/planning.md](web/planning.md) holds the story and the decisions behind it |

## Working rules

- **Commits:** Isaac is the sole author. Add no `Co-Authored-By` trailer or any other Claude
  attribution.
- **Data:** use official open releases only (portals, WFS, APIs). No scraping.
- **Runs:** full runs (extraction, routing, full results) are Isaac's unless he hands one over.
  Check changes with `python -m pipeline run --sample 300`.
- **Writing:** American English; "public transport", never "transit"; gloss German terms.
