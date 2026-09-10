# Precomputed data

Written by [`scripts/precompute.py`](../scripts/precompute.py) and read by the
app. **Do not edit by hand** — regenerate instead.

## Why it is committed

FastF1 is a Python library that pulls from the F1 live timing API. It cannot
run per request: wrong runtime for the app, tens of megabytes on a cold
session, and a large on-disk cache. So it runs ahead of time and the app reads
the result. Committing the output rather than generating it in CI keeps the
data reviewable and means a deploy can never produce a site with missing
charts because a scheduled job failed.

## Layout

```
data/<season>/<round>.json.gz       race data
data/<season>/<round>.tel.json.gz   qualifying telemetry, when published
data/<season>/index.json            what exists (uncompressed, readable)
```

## Format

Arrays of tuples, gzipped. Tuples are ~2.3x smaller than the equivalent
objects before compression and gzip takes about another 5x off; a full race is
roughly 16 KB and its telemetry 60–80 KB.

Every file carries a `schema` object naming each table's fields in order, so
the format is readable without opening the pipeline, and the TypeScript
decoder validates against it.

```jsonc
"schema": { "laps": ["driver","lap","seconds","clock","compound","stint","position"] },
"laps":   [ ["VER", 1, null, 3704.1, "SOFT", 1, 1], ... ]
```

Output is deterministic — sorted keys, pinned gzip mtime — so re-running on
unchanged data produces an identical file rather than a spurious diff.

## Regenerating

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt

.venv/bin/python scripts/precompute.py --season 2024
.venv/bin/python scripts/precompute.py --seasons 2018 2019 2020
.venv/bin/python scripts/precompute.py --season 2026 --round 13 --force
.venv/bin/python scripts/precompute.py --season 2026 --no-telemetry
```

Existing rounds are skipped unless `--force`. A full backfill from 2018 is
several hours of downloading, so it is meant to be run in stages and survive
interruption. `.fastf1-cache/` is gitignored; the first run for a session is
slow and later ones are not.

## Caveats worth knowing before plotting anything

- **Lap 1 has no lap time.** A standing start is not a flying lap, so
  `seconds` is null on lap 1 while `clock` is present. Gaps between drivers
  must be derived from `clock` differences; summing lap times makes the whole
  field appear level at lap 2.
- **`pitLaneSeconds` is total pit lane time**, entry to exit — not the
  stationary time quoted on television. Expect roughly 20s where a broadcast
  says 2.4.
- **Telemetry comes from qualifying, not the race.** In a race each driver's
  fastest lap arrives at a different moment on a different fuel load and tyre
  age, so comparing them measures strategy as much as pace. Qualifying has the
  whole field on low fuel and new tyres attacking the same lap.
- **Mini-sector `fastest` is noisy across all twenty drivers.** The gaps
  between drivers through a single mini-sector are often within the noise, so
  the winner flips easily — the first version of this produced eleven
  different "winners" across twenty-five sectors. It is kept as an at-a-glance
  default, but the meaningful comparison is between two or three drivers, and
  the full traces are stored so that can be computed for any subset.
- **The reference lap is the outright fastest of qualifying**, which is not
  always the pole lap: at Bahrain 2024 it is Leclerc's 1:29.165 from Q2, ahead
  of Verstappen's 1:29.179 pole.
- **Telemetry does not exist for every season.** It is published from 2018 and
  is absent for 2026; those races simply have no `.tel.json.gz` and
  `index.json` records `hasTelemetry: false`.
- **A driver with no laps is omitted** from `laps` but may still appear in
  `drivers`, so never assume the tables cover the same set.
