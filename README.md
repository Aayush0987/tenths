# Tenths

Formula 1 race analysis, 2018 to now.

Not a dashboard. The question it answers is what actually happened in a race
and why — tyre degradation, where a lap was lost, when the race was
neutralised, how a stint decayed — and, across nine seasons, how that compares
between eras.

## Status

Early. See [`docs/PLAN.md`](docs/PLAN.md) for the roadmap.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4, Recharts. Data is
precomputed from [FastF1](https://github.com/theOehrly/Fast-F1) by a Python
pipeline and committed as compressed JSON — the app never runs Python.

## Licence

MIT. Timing data comes from the F1 live timing API via FastF1 and from
[JOLPICA](https://github.com/jolpica/jolpica-f1). This project is unofficial
and not associated with Formula 1, the FIA, or any team.
