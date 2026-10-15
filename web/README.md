# Web app

The map-first story of the analysis, built with Svelte, Vite and MapLibre. For the story and the
decisions behind it, see [planning.md](planning.md).

## Run it

```sh
npm install
npm run dev
```

`npm run dev` copies the analysis results into `public/data/` and starts the Vite dev server. To
use the sample run's results (`analysis/sample/results/`) instead of the full run's:

```sh
DATA=sample npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Copies the data and starts the dev server |
| `npm run build` | Copies the data and builds the site into `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run data` | Only copies the data |
