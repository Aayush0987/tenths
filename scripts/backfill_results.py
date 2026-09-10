#!/usr/bin/env python3
"""
Add final classification to race files that were written before the pipeline
exported it.

    python scripts/backfill_results.py --seasons 2024 2025 2026
    python scripts/backfill_results.py --season 2024 --round 1

This exists instead of `precompute.py --force` because forcing would re-derive
everything already correct on disk — including reloading qualifying telemetry,
which is the slow part of a run and produces byte-identical output. Here only
the race and sprint classifications are fetched, and each file is rewritten
with the results table added and nothing else touched.

Safe to re-run: a file that already carries results is skipped unless --force.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import extract  # noqa: E402
from encoding import read_gz, write_gz  # noqa: E402
from precompute import CACHE, DATA, log, use_jolpica  # noqa: E402


def backfill_round(season: int, round_no: int, path: Path, force: bool) -> str:
    import fastf1

    payload = read_gz(path)
    if payload.get("results") and not force:
        return "skipped"

    race = fastf1.get_session(season, round_no, "R")
    race.load(laps=False, telemetry=False, weather=False, messages=False)

    sprint_points = {}
    try:
        sprint = fastf1.get_session(season, round_no, "S")
        sprint.load(laps=False, telemetry=False, weather=False, messages=False)
        sprint_points = extract.build_sprint_points(sprint)
    except ValueError:
        pass
    except Exception as err:
        log(f"    sprint unavailable: {err}")

    schema, rows, winner_seconds = extract.build_results(race, sprint_points)
    classified = sum(1 for r in rows if r[1] is not None)
    if classified == 0:
        # Writing an empty results table would look identical to a race that
        # genuinely had none, and would then be skipped on every later run.
        return "no results"

    payload["results"] = rows
    payload["winnerSeconds"] = winner_seconds
    payload.setdefault("schema", {})["results"] = schema

    write_gz(path, payload)
    return f"{classified} classified" + (f", {len(sprint_points)} sprint" if sprint_points else "")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--season", type=int)
    group.add_argument("--seasons", type=int, nargs="+")
    parser.add_argument("--round", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    try:
        import fastf1
    except ImportError:
        log("fastf1 is not installed. Run: .venv/bin/pip install -r scripts/requirements.txt")
        return 1

    CACHE.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE))
    use_jolpica()

    done = skipped = failed = 0
    started = time.time()

    for season in (args.seasons or [args.season]):
        season_dir = DATA / str(season)
        if not season_dir.exists():
            log(f"{season}: no data directory")
            continue

        paths = sorted(
            (p for p in season_dir.glob("[0-9]*.json.gz") if not p.name.endswith(".tel.json.gz")),
            key=lambda p: int(p.name.split(".")[0]),
        )
        if args.round:
            paths = [p for p in paths if int(p.name.split(".")[0]) == args.round]

        log(f"{season}: {len(paths)} file(s)")
        for path in paths:
            round_no = int(path.name.split(".")[0])
            try:
                outcome = backfill_round(season, round_no, path, args.force)
            except Exception as err:
                log(f"  R{round_no}: FAILED {type(err).__name__}: {err}")
                failed += 1
                continue

            if outcome == "skipped":
                skipped += 1
            else:
                log(f"  R{round_no}: {outcome}")
                done += 1
            # JOLPICA asks for restraint and a backfill is the one thing that
            # would trip its limit; the whole run is still only a few minutes.
            time.sleep(0.3)

    log(f"done — {done} updated, {skipped} already had results, {failed} failed "
        f"in {(time.time() - started) / 60:.1f} min")
    return 1 if failed and not done else 0


if __name__ == "__main__":
    sys.exit(main())
