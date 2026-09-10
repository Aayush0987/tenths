#!/usr/bin/env python3
"""
Precompute race data from FastF1 into the committed files the app reads.

    python scripts/precompute.py --season 2024
    python scripts/precompute.py --season 2024 --round 1 --force
    python scripts/precompute.py --seasons 2024 2025 2026
    python scripts/precompute.py --season 2026 --no-telemetry

Writes, per race:
    data/<season>/<round>.json.gz       laps, stints, pit stops, sectors,
                                        qualifying, race control, weather
    data/<season>/<round>.tel.json.gz   fastest-lap traces and mini-sector
                                        dominance, when the season has any
and per season:
    data/<season>/index.json            what exists, uncompressed so it can be
                                        read at a glance

Existing files are skipped unless --force, because a full backfill of 2018
onwards is eight to ten hours of downloading and has to survive being
interrupted.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import extract  # noqa: E402
import telemetry as telemetry_mod  # noqa: E402
from encoding import FORMAT_VERSION, write_gz  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = ROOT / ".fastf1-cache"


def log(msg: str) -> None:
    print(msg, flush=True)


def load_race(season: int, round_no: int):
    import fastf1

    # Race telemetry is not loaded: the traces and the dominance map are built
    # from qualifying instead. See below.
    race = fastf1.get_session(season, round_no, "R")
    race.load(telemetry=False, weather=True, messages=True)
    return race


def precompute_round(season: int, round_no: int, want_telemetry: bool) -> tuple[dict, dict | None] | None:
    import fastf1

    race = load_race(season, round_no)

    # A race that has not run — including one taking place today — loads
    # without error but raises on .laps, so this cannot be an emptiness check.
    try:
        laps = race.laps
    except fastf1.core.DataNotLoadedError:
        log(f"    no lap data yet (session not run)")
        return None
    if laps is None or laps.empty:
        log(f"    no lap data")
        return None

    event = race.event
    driver_schema, drivers = extract.build_drivers(race)
    lap_schema, lap_rows = extract.build_laps(laps)
    stint_schema, stints = extract.build_stints(laps)
    pit_schema, pits = extract.build_pit_stops(laps)
    sector_schema, sectors = extract.build_sectors(laps)
    rc_schema, rc = extract.build_race_control(race)
    weather_schema, weather = extract.build_weather(race)

    quali_schema, quali = ["driver", "position", "q1", "q2", "q3"], []
    quali_session = None
    try:
        q = fastf1.get_session(season, round_no, "Q")
        # messages=True or FastF1 cannot resolve deleted laps and every
        # Q1/Q2/Q3 comes back empty. telemetry follows want_telemetry because
        # the traces come from here rather than from the race.
        q.load(telemetry=want_telemetry, weather=False, messages=True)
        quali_schema, quali = extract.build_qualifying(q)
        quali_session = q
    except Exception as err:
        log(f"    qualifying unavailable: {err}")

    race_payload = {
        "v": FORMAT_VERSION,
        "season": season,
        "round": round_no,
        "raceName": str(event.get("EventName") or ""),
        "location": str(event.get("Location") or ""),
        "country": str(event.get("Country") or ""),
        "date": str(event.get("EventDate"))[:10] if event.get("EventDate") is not None else None,
        "totalLaps": int(laps["LapNumber"].max()),
        "schema": {
            "drivers": driver_schema, "laps": lap_schema, "stints": stint_schema,
            "pitStops": pit_schema, "sectors": sector_schema,
            "raceControl": rc_schema, "weather": weather_schema, "qualifying": quali_schema,
        },
        "drivers": drivers,
        "laps": lap_rows,
        "stints": stints,
        "pitStops": pits,
        "sectors": sectors,
        "raceControl": rc,
        "weather": weather,
        "qualifying": quali,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": f"FastF1 {fastf1.__version__}",
    }

    tel_payload = None
    if want_telemetry and quali_session is not None:
        try:
            # Qualifying, not the race. In a race every driver's fastest lap
            # comes at a different moment on a different fuel load and tyre
            # age, so comparing them says as much about strategy as about pace
            # — the first run of this produced twelve different mini-sector
            # "winners", which is noise. In qualifying the whole field is on
            # low fuel and new tyres attacking the same lap, which is the
            # comparison a dominance map is claiming to make.
            tel = telemetry_mod.build_telemetry(quali_session, log=log)
            if tel is None:
                log("    telemetry not published for this season")
            else:
                tel_payload = {"v": FORMAT_VERSION, "season": season, "round": round_no, **tel}
        except Exception as err:
            log(f"    telemetry failed: {err}")

    log(f"    {len(drivers)} drivers, {len(lap_rows)} laps, {len(stints)} stints, "
        f"{len(rc)} rc, {len(weather)} weather")
    return race_payload, tel_payload


def write_index(season: int) -> None:
    from encoding import read_gz

    season_dir = DATA / str(season)
    races = []
    if season_dir.exists():
        for path in sorted(season_dir.glob("[0-9]*.json.gz")):
            if path.name.endswith(".tel.json.gz"):
                continue
            try:
                d = read_gz(path)
            except Exception:
                continue
            races.append({
                "round": d.get("round"),
                "raceName": d.get("raceName"),
                "location": d.get("location"),
                "country": d.get("country"),
                "date": d.get("date"),
                "totalLaps": d.get("totalLaps"),
                "hasTelemetry": (season_dir / f"{d.get('round')}.tel.json.gz").exists(),
            })
    races.sort(key=lambda r: r["round"] or 0)
    season_dir.mkdir(parents=True, exist_ok=True)
    (season_dir / "index.json").write_text(
        json.dumps({"season": season, "races": races,
                    "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds")},
                   indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def run_season(season: int, rounds: list[int] | None, force: bool, want_telemetry: bool) -> tuple[int, int, int]:
    import fastf1

    season_dir = DATA / str(season)
    if rounds is None:
        schedule = fastf1.get_event_schedule(season, include_testing=False)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        rounds = [int(r) for r in schedule[schedule["EventDate"] < now]["RoundNumber"].tolist()]
        log(f"  {season}: {len(rounds)} completed round(s)")

    written = skipped = failed = 0
    for round_no in rounds:
        out = season_dir / f"{round_no}.json.gz"
        if out.exists() and not force:
            skipped += 1
            continue
        started = time.time()
        log(f"  {season} R{round_no}")
        try:
            result = precompute_round(season, round_no, want_telemetry)
            if result is None:
                continue
            race_payload, tel_payload = result
            size = write_gz(out, race_payload)
            note = f"{size/1024:.0f} KB"
            if tel_payload is not None:
                tsize = write_gz(season_dir / f"{round_no}.tel.json.gz", tel_payload)
                note += f" + {tsize/1024:.0f} KB telemetry"
            log(f"    wrote {note} in {time.time()-started:.0f}s")
            written += 1
        except Exception as err:
            log(f"    FAILED: {err}")
            traceback.print_exc()
            failed += 1
    write_index(season)
    return written, skipped, failed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--season", type=int)
    group.add_argument("--seasons", type=int, nargs="+")
    parser.add_argument("--round", type=int, help="single round; omit for every completed round")
    parser.add_argument("--force", action="store_true", help="regenerate rounds that already exist")
    parser.add_argument("--no-telemetry", action="store_true", help="skip telemetry (much faster)")
    args = parser.parse_args()

    try:
        import fastf1
    except ImportError:
        log("fastf1 is not installed. Run: .venv/bin/pip install -r scripts/requirements.txt")
        return 1

    CACHE.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE))

    seasons = args.seasons or [args.season]
    rounds = [args.round] if args.round else None
    totals = [0, 0, 0]
    started = time.time()

    for season in seasons:
        w, s, f = run_season(season, rounds, args.force, not args.no_telemetry)
        totals = [totals[0] + w, totals[1] + s, totals[2] + f]

    log(f"done — {totals[0]} written, {totals[1]} skipped, {totals[2]} failed "
        f"in {(time.time()-started)/60:.1f} min")
    return 1 if totals[2] and not totals[0] else 0


if __name__ == "__main__":
    sys.exit(main())
