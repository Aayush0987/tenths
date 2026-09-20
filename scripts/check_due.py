"""
Print the rounds of a season that have run but have no data file yet.

Exits 0 either way; the caller decides what to do with the list. Uses the same
one-day settling buffer as precompute.has_run, so a round is only "due" once
precompute would actually consider it.

    python scripts/check_due.py [--season 2026]
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = ROOT / ".fastf1-cache"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    args = parser.parse_args()

    import fastf1

    CACHE.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE))

    schedule = fastf1.get_event_schedule(args.season, include_testing=False)
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)

    due = [
        int(row.RoundNumber)
        for row in schedule.itertuples()
        if row.EventDate < cutoff and not (DATA / str(args.season) / f"{int(row.RoundNumber)}.json.gz").exists()
    ]
    print(" ".join(str(r) for r in due))
    return 0


if __name__ == "__main__":
    sys.exit(main())
