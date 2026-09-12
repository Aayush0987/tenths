#!/usr/bin/env python3
"""
Check every committed data file reads and carries what the app expects.

    python scripts/verify.py
    python scripts/verify.py --season 2019

A long backfill is the one place a silently broken file can hide: precompute
skips rounds whose file already exists, so anything corrupt stays corrupt and
simply disappears from the site. This reads every file, checks the tables the
decoder requires are present with the right schema, and reports what is
missing rather than leaving it to be noticed as a blank chart months later.

Exits non-zero if anything failed, so it can gate a commit.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from encoding import read_gz  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Tables the TypeScript decoder expects, with the field order it checks
# against. Kept in step with lib/data/read.ts by hand; a mismatch here is the
# same failure it would throw at runtime, found earlier.
SCHEMAS = {
    "drivers": ["code", "number", "name", "team", "teamColor"],
    "laps": ["driver", "lap", "seconds", "clock", "compound", "stint", "position"],
    "stints": ["driver", "stint", "compound", "lapStart", "lapEnd", "laps", "fresh"],
    "pitStops": ["driver", "lap", "pitLaneSeconds"],
    "sectors": ["driver", "s1", "s2", "s3", "speedTrapKph"],
    "qualifying": ["driver", "position", "q1", "q2", "q3"],
    "raceControl": ["lap", "category", "flag", "scope", "message"],
    "weather": ["minutes", "airTemp", "trackTemp", "humidity", "windSpeed", "rain"],
    "results": ["driver", "position", "classified", "grid", "status",
                "points", "sprintPoints", "gapSeconds"],
}

TELEMETRY_TRACE_FIELDS = ["x", "y", "distance", "speed", "throttle", "brake", "t"]


def check_race(path: Path) -> list[str]:
    problems: list[str] = []
    try:
        d = read_gz(path)
    except Exception as err:
        return [f"unreadable: {type(err).__name__}: {err}"]

    for key in ("season", "round", "raceName", "totalLaps"):
        if d.get(key) in (None, ""):
            problems.append(f"missing {key}")

    if not d.get("circuitId"):
        problems.append("no circuitId (run backfill_circuits.py)")

    schema = d.get("schema") or {}
    for table, fields in SCHEMAS.items():
        rows = d.get(table)
        if rows is None:
            problems.append(f"{table}: absent")
            continue
        if not rows:
            # An empty table is legitimate — a race can have no pit stops
            # recorded, and seasons differ in what they publish.
            continue
        actual = schema.get(table)
        if actual != fields:
            problems.append(f"{table}: schema {actual} != {fields}")
            continue
        width = len(fields)
        bad = sum(1 for r in rows if not isinstance(r, list) or len(r) != width)
        if bad:
            problems.append(f"{table}: {bad} of {len(rows)} rows are not {width} wide")

    if not d.get("results"):
        problems.append("no results (run backfill_results.py)")
    elif not any(r[1] is not None for r in d["results"]):
        problems.append("results present but nothing classified")

    if not d.get("laps"):
        problems.append("no laps")

    return problems


def check_telemetry(path: Path) -> list[str]:
    try:
        d = read_gz(path)
    except Exception as err:
        return [f"unreadable: {type(err).__name__}: {err}"]

    problems: list[str] = []
    fields = (d.get("schema") or {}).get("traces")
    if fields != TELEMETRY_TRACE_FIELDS:
        problems.append(f"traces schema {fields} != {TELEMETRY_TRACE_FIELDS}")
    if not d.get("traces"):
        problems.append("no traces")
    if not d.get("path"):
        problems.append("no path")
    if not d.get("reference"):
        problems.append("no reference driver")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, help="check one season; omit for all")
    args = parser.parse_args()

    seasons = (
        [args.season] if args.season
        else sorted(int(p.name) for p in DATA.iterdir() if p.is_dir() and p.name.isdigit())
    )

    failures = 0
    races = telemetry = 0

    for season in seasons:
        season_dir = DATA / str(season)
        paths = sorted(
            (p for p in season_dir.glob("[0-9]*.json.gz") if not p.name.endswith(".tel.json.gz")),
            key=lambda p: int(p.name.split(".")[0]),
        )
        leftovers = list(season_dir.glob(".*.tmp"))
        for leftover in leftovers:
            print(f"  {season}: stray temp file {leftover.name} — an interrupted write")
            failures += 1

        season_bad = 0
        for path in paths:
            races += 1
            for problem in check_race(path):
                print(f"  {season} R{path.name.split('.')[0]}: {problem}")
                season_bad += 1

            tel = season_dir / f"{path.name.split('.')[0]}.tel.json.gz"
            if tel.exists():
                telemetry += 1
                for problem in check_telemetry(tel):
                    print(f"  {season} R{path.name.split('.')[0]} telemetry: {problem}")
                    season_bad += 1

        index = season_dir / "index.json"
        if not index.exists():
            print(f"  {season}: no index.json")
            season_bad += 1

        failures += season_bad
        print(f"{season}: {len(paths)} races" + (f", {season_bad} problem(s)" if season_bad else " — clean"))

    print(f"\n{races} races, {telemetry} with telemetry, {failures} problem(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
