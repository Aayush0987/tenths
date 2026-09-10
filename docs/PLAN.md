# Tenths — plan

## What this is

An F1 race analysis tool covering 2018 to the present. It answers what
happened in a race and why, and — because it spans nine seasons — how that
compares between eras.

The charts are the product. Standings and calendars exist only as navigation.

## Data

Roughly 190 races. Measured, not estimated:

| | per race | per season | 2018–2026 |
|---|---|---|---|
| Race data (laps, stints, sectors, weather, race control) | ~100 KB | ~2.4 MB | ~22 MB |
| Telemetry (20 drivers, fastest lap, downsampled to ~235 points) | ~200 KB | ~4.7 MB | ~42 MB |
| **Committed, gzipped** | | | **~15 MB** |

Decisions and why:

- **Tuple encoding, not objects.** `[1, 87.5, "M"]` rather than
  `{"lap":1,"seconds":87.5,"compound":"M"}`. Measured 2.3× smaller on real
  telemetry. A decode helper on read keeps call sites typed.
- **Gzipped on disk, decompressed server-side.** Another ~5×. Node's zlib, no
  infrastructure.
- **No database.** Cross-season questions are answered by aggregate files the
  pipeline emits — season summaries, driver careers, team mate records — not
  by querying 190 files at request time. If ad-hoc querying ever becomes the
  point, DuckDB-WASM in the browser is the answer, not a server database.
- **The pipeline is resumable and must stay that way.** A full backfill is
  8–10 hours of downloading, so it runs in stages and skips what exists.

## Telemetry availability

Telemetry exists from 2018 and is **absent for 2026** — verified: a 2024
session returns 704 rows with X/Y for a lap, a 2026 session raises
`DataNotLoadedError`. So the track map, speed traces and delta-vs-distance
work for completed seasons and are simply hidden for the current one. That is
a feature of the data, not a bug to work around.

## Routes

```
/                        season selector, latest race
/[season]                season overview, championship progression
/[season]/[round]        the race page — every analysis
/[season]/[round]/lap    lap explorer: telemetry, traces, delta
/drivers/[id]            career across all seasons
/compare                 driver vs driver, any era
/circuits/[id]           one circuit across years
```

`/circuits/[id]` and cross-era `/compare` only exist because of the nine-season
scope. They are the pages a single-season app cannot have.

## Interface

An analyst's terminal, not a magazine.

- Dark by default, one dense grid, minimal chrome
- Tabular figures throughout — real `tabular-nums`, no display serif
- Everything visible at once; no accordions or carousels
- Keyboard first: `/` search, `j`/`k` between races, digits to jump to a chart

## Phases

| Phase | Content |
|---|---|
| 0 | Repo, licence, CI, design tokens, terminal shell |
| 1 | Pipeline v2 — tuple encoding, gzip, telemetry, aggregates. Run 2024–2026 |
| 2 | Race page: the ten existing analyses in the new shell |
| 3 | Track dominance map, speed traces, delta-vs-distance |
| 4 | Season, driver-career and circuit-history pages |
| 5 | Backfill 2018–2023; cross-era comparison |
| v2 | AI narration of a chart, grounded in the precomputed numbers |

## Notes carried from prior work

- Team colours **fail** as a categorical palette — Haas and Alpine are ΔE 1.0
  apart under deuteranopia. They stay as an affordance, never the encoding,
  and every chart using them prints the driver code.
- Compound colours are F1's official ones; they pass both discrimination
  checks. Hard is stepped down in the light theme because #F0F0EC is 1.11:1
  against a pale ground.
- Gaps come from each lap's session clock, never from summed lap times —
  FastF1 records no lap time for lap 1.
- JOLPICA reports a lapped driver as `Lapped`, not `+1 Lap`.
- Suspense streaming works on Next 16.3.4 (verified in this repo). It did not
  on 16.2.9 in the previous project, so re-verify after any Next upgrade.
