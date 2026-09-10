#!/usr/bin/env python3
"""
Add stable circuit identity to race files written before the pipeline carried
it.

    python scripts/backfill_circuits.py --seasons 2024 2025 2026

One request per season, then a rewrite of each file with circuitId,
circuitName and locality filled in. See extract.fetch_circuit_index for why
the identifier is needed at all.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import extract  # noqa: E402
from encoding import read_gz, write_gz  # noqa: E402
from precompute import DATA, log  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--season", type=int)
    group.add_argument("--seasons", type=int, nargs="+")
    args = parser.parse_args()

    done = failed = 0
    started = time.time()

    for season in (args.seasons or [args.season]):
        season_dir = DATA / str(season)
        if not season_dir.exists():
            log(f"{season}: no data directory")
            continue

        try:
            index = extract.fetch_circuit_index(season)
        except Exception as err:
            log(f"{season}: could not fetch schedule: {err}")
            failed += 1
            continue

        paths = sorted(
            (p for p in season_dir.glob("[0-9]*.json.gz") if not p.name.endswith(".tel.json.gz")),
            key=lambda p: int(p.name.split(".")[0]),
        )
        log(f"{season}: {len(paths)} file(s), {len(index)} scheduled round(s)")

        for path in paths:
            round_no = int(path.name.split(".")[0])
            entry = index.get(round_no)
            if not entry or not entry.get("circuitId"):
                log(f"  R{round_no}: no circuit in schedule, left alone")
                failed += 1
                continue

            payload = read_gz(path)
            payload.update(entry)
            write_gz(path, payload)
            done += 1

    log(f"done — {done} updated, {failed} failed in {(time.time() - started):.0f}s")
    return 1 if failed and not done else 0


if __name__ == "__main__":
    sys.exit(main())
