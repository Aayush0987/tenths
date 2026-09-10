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
from datetime import datetime, timedelta, timezone
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


def use_jolpica() -> None:
    """
    Point FastF1's results lookup at JOLPICA.

    FastF1 3.4.4 reads final classification from ergast.com, which has been
    retired: the request fails and every result column comes back NaN, with
    only a warning in the log. JOLPICA is the maintained continuation of the
    same API and speaks the same responses, so redirecting the base URL is
    enough — no parsing of our own, and session.results populates as FastF1
    intends. Kept here rather than in extract so there is one place to change
    when FastF1 ships its own switch.
    """
    import fastf1.ergast.interface as ergast

    ergast.BASE_URL = "https://api.jolpi.ca/ergast/f1"


def load_race(season: int, round_no: int, attempts: int = 3):
    """
    Load a race session, retrying transient failures.

    A long backfill hammers the timing API and some loads simply fail. Left
    alone those look exactly like a race that has not run, which is how a
    whole season quietly produced one file instead of twenty-four.
    """
    import fastf1

    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            # Race telemetry is not loaded: traces and dominance come from
            # qualifying instead. See precompute_round.
            race = fastf1.get_session(season, round_no, "R")
            race.load(telemetry=False, weather=True, messages=True)
            _ = race.laps  # force the failure here, where it can be retried
            return race
        except Exception as err:
            last_error = err
            if attempt < attempts:
                wait = 5 * attempt
                log(f"    load attempt {attempt} failed ({type(err).__name__}), retrying in {wait}s")
                time.sleep(wait)
    raise RuntimeError(f"could not load after {attempts} attempts: {last_error}")


def has_run(season: int, round_no: int) -> bool:
    """Whether the race is far enough in the past that data should exist."""
    import fastf1

    try:
        schedule = fastf1.get_event_schedule(season, include_testing=False)
        row = schedule[schedule["RoundNumber"] == round_no]
        if row.empty:
            return True
        date = row.iloc[0]["EventDate"]
        return bool(date < datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1))
    except Exception:
        return True


def precompute_round(season: int, round_no: int, want_telemetry: bool) -> tuple[dict, dict | None] | None:
    import fastf1

    race = load_race(season, round_no)

    # load_race already forced .laps, so reaching here means it is present.
    laps = race.laps
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

    # Sprint points count toward the championship, so a progression built
    # from race points alone is wrong by up to eight points a driver on the
    # six sprint weekends a season. Rounds without a sprint raise, which is
    # the normal case rather than a failure.
    sprint_points = {}
    try:
        sprint = fastf1.get_session(season, round_no, "S")
        sprint.load(laps=False, telemetry=False, weather=False, messages=False)
        sprint_points = extract.build_sprint_points(sprint)
        if sprint_points:
            log(f"    sprint: {len(sprint_points)} scorers")
    except ValueError:
        pass
    except Exception as err:
        log(f"    sprint unavailable: {err}")

    results_schema, results, winner_seconds = extract.build_results(race, sprint_points)
    if not any(r[1] is not None for r in results):
        log("    WARNING: no classified positions — results feed unavailable")

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

    # Stable circuit identity, so the circuit page can group seasons. Failing
    # here must not lose a race: the file is still correct without it, and
    # backfill_circuits.py can fill it in later.
    circuit = {}
    try:
        circuit = extract.fetch_circuit_index(season).get(round_no, {})
    except Exception as err:
        log(f"    circuit index unavailable: {err}")

    race_payload = {
        "v": FORMAT_VERSION,
        "season": season,
        "round": round_no,
        "raceName": str(event.get("EventName") or ""),
        "location": str(event.get("Location") or ""),
        "country": str(event.get("Country") or ""),
        "circuitId": circuit.get("circuitId"),
        "circuitName": circuit.get("circuitName"),
        "locality": circuit.get("locality"),
        "date": str(event.get("EventDate"))[:10] if event.get("EventDate") is not None else None,
        "totalLaps": int(laps["LapNumber"].max()),
        "schema": {
            "drivers": driver_schema, "laps": lap_schema, "stints": stint_schema,
            "pitStops": pit_schema, "sectors": sector_schema,
            "raceControl": rc_schema, "weather": weather_schema, "qualifying": quali_schema,
            "results": results_schema,
        },
        "drivers": drivers,
        "laps": lap_rows,
        "stints": stints,
        "pitStops": pits,
        "sectors": sectors,
        "raceControl": rc,
        "weather": weather,
        "qualifying": quali,
        "results": results,
        "winnerSeconds": winner_seconds,
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
                "circuitId": d.get("circuitId"),
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
            # A race in the future legitimately has no data; one in the past
            # that will not load is a failure worth seeing and retrying.
            if not has_run(season, round_no):
                log("    not run yet, skipping")
                continue
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
    use_jolpica()

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
