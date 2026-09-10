"""
Turning a loaded FastF1 session into the tuple tables the app reads.

Each builder returns (schema, rows): the schema names the tuple fields in
order and travels with the data, so a file can be read without this module.
"""

from __future__ import annotations

import pandas as pd

from encoding import rounded

# Points kept per driver telemetry trace. 235 is what a real lap downsamples
# to at this stride; enough for a legible speed trace and a smooth track path,
# and ~10 KB per driver once tuple-encoded.
TELEMETRY_POINTS = 235
# Mini-sectors for the track dominance map. 25 is fine enough to show which
# driver owned which corner without turning the lap into confetti.
MINI_SECTORS = 25


def build_drivers(session):
    schema = ["code", "number", "name", "team", "teamColor"]
    rows = []
    for abbr in session.drivers:
        try:
            d = session.get_driver(abbr)
        except Exception:
            continue
        colour = str(d.get("TeamColor") or "").lstrip("#")
        rows.append([
            str(d.get("Abbreviation") or abbr),
            str(d.get("DriverNumber") or abbr),
            str(d.get("FullName") or ""),
            str(d.get("TeamName") or ""),
            f"#{colour}" if colour else None,
        ])
    rows.sort(key=lambda r: r[0])
    return schema, rows


def build_laps(laps):
    """
    One row per driver-lap, replacing the several parallel series the previous
    version emitted. The driver code and lap number were repeated in each of
    them; here they are written once.

    `seconds` is null on lap 1 — a standing start is not a flying lap — while
    `clock` is present throughout, which is why gaps must be derived from the
    clock and never from summed lap times.
    """
    schema = ["driver", "lap", "seconds", "clock", "compound", "stint", "position"]
    rows = []
    for _, r in laps.iterrows():
        lap_time = r.get("LapTime")
        clock = r.get("Time")
        if (lap_time is None or pd.isna(lap_time)) and (clock is None or pd.isna(clock)):
            continue
        compound = r.get("Compound")
        stint = r.get("Stint")
        pos = r.get("Position")
        rows.append([
            str(r["Driver"]),
            int(r["LapNumber"]),
            rounded(lap_time.total_seconds()) if lap_time is not None and not pd.isna(lap_time) else None,
            rounded(clock.total_seconds()) if clock is not None and not pd.isna(clock) else None,
            str(compound).upper() if compound is not None and not pd.isna(compound) else None,
            int(stint) if stint is not None and not pd.isna(stint) else None,
            int(pos) if pos is not None and not pd.isna(pos) else None,
        ])
    rows.sort(key=lambda r: (r[1], r[0]))
    return schema, rows


def build_stints(laps):
    schema = ["driver", "stint", "compound", "lapStart", "lapEnd", "laps", "fresh"]
    rows = []
    for (driver, stint_no), g in laps.groupby(["Driver", "Stint"], dropna=True):
        nums = g["LapNumber"].dropna()
        if nums.empty:
            continue
        compound = g["Compound"].dropna()
        fresh = g["FreshTyre"].dropna()
        rows.append([
            str(driver), int(stint_no),
            str(compound.iloc[0]).upper() if not compound.empty else "UNKNOWN",
            int(nums.min()), int(nums.max()), int(len(nums)),
            bool(fresh.iloc[0]) if not fresh.empty else None,
        ])
    rows.sort(key=lambda r: (r[0], r[1]))
    return schema, rows


def build_pit_stops(laps):
    """
    PitInTime is on the lap a driver enters and PitOutTime on the lap they
    rejoin, so the two live on consecutive rows and subtracting within one row
    yields nothing. This is total pit lane time, not the stationary time quoted
    on television — expect about 20s where a broadcast says 2.4.
    """
    schema = ["driver", "lap", "pitLaneSeconds"]
    rows = []
    for driver, g in laps.groupby("Driver"):
        g = g.sort_values("LapNumber").reset_index(drop=True)
        for i, lap in g.iterrows():
            pit_in = lap.get("PitInTime")
            if pit_in is None or pd.isna(pit_in):
                continue
            secs = None
            if i + 1 < len(g):
                pit_out = g.loc[i + 1, "PitOutTime"]
                if pit_out is not None and not pd.isna(pit_out):
                    secs = rounded((pit_out - pit_in).total_seconds())
            rows.append([str(driver), int(lap["LapNumber"]), secs])
    rows.sort(key=lambda r: (r[1], r[0]))
    return schema, rows


def build_sectors(laps):
    """Best time in each sector, taken independently, plus the best speed trap."""
    schema = ["driver", "s1", "s2", "s3", "speedTrapKph"]
    rows = []
    for driver, g in laps.groupby("Driver"):
        best = []
        for i in (1, 2, 3):
            col = f"Sector{i}Time"
            vals = g[col].dropna() if col in g else pd.Series(dtype="object")
            best.append(rounded(vals.min().total_seconds()) if not vals.empty else None)
        if any(b is None for b in best):
            continue
        trap = g["SpeedST"].dropna() if "SpeedST" in g else pd.Series(dtype="float")
        rows.append([str(driver), *best, rounded(trap.max(), 1) if not trap.empty else None])
    rows.sort(key=lambda r: r[0])
    return schema, rows


def build_race_control(session):
    schema = ["lap", "category", "flag", "scope", "message"]
    try:
        msgs = session.race_control_messages
    except Exception:
        return schema, []
    if msgs is None or msgs.empty:
        return schema, []
    rows = []
    for _, r in msgs.iterrows():
        lap = r.get("Lap")
        rows.append([
            int(lap) if lap is not None and not pd.isna(lap) else None,
            str(r.get("Category") or "Other"),
            str(r["Flag"]) if r.get("Flag") is not None and not pd.isna(r.get("Flag")) else None,
            str(r["Scope"]) if r.get("Scope") is not None and not pd.isna(r.get("Scope")) else None,
            str(r.get("Message") or "").strip(),
        ])
    return schema, rows


def build_weather(session):
    schema = ["minutes", "airTemp", "trackTemp", "humidity", "windSpeed", "rain"]
    try:
        w = session.weather_data
    except Exception:
        return schema, []
    if w is None or w.empty:
        return schema, []
    rows = []
    for _, r in w.iterrows():
        t = r.get("Time")
        rows.append([
            rounded(t.total_seconds() / 60, 2) if t is not None and not pd.isna(t) else None,
            rounded(r.get("AirTemp"), 1),
            rounded(r.get("TrackTemp"), 1),
            rounded(r.get("Humidity"), 1),
            rounded(r.get("WindSpeed"), 1),
            bool(r["Rainfall"]) if r.get("Rainfall") is not None and not pd.isna(r.get("Rainfall")) else None,
        ])
    return schema, rows


def build_qualifying(session):
    schema = ["driver", "position", "q1", "q2", "q3"]

    def fmt(v):
        if v is None or pd.isna(v):
            return None
        total = v.total_seconds()
        m, s = divmod(total, 60)
        return f"{int(m)}:{s:06.3f}"

    rows = []
    for _, r in session.results.iterrows():
        pos = r.get("Position")
        rows.append([
            str(r.get("Abbreviation") or ""),
            int(pos) if pos is not None and not pd.isna(pos) else None,
            fmt(r.get("Q1")), fmt(r.get("Q2")), fmt(r.get("Q3")),
        ])
    rows.sort(key=lambda r: (r[1] is None, r[1] or 0))
    return schema, rows


def build_results(session, sprint_points=None):
    """
    Final classification.

    Position comes from ClassifiedPosition rather than from Status. Status is
    free text from the results feed and its vocabulary is not stable —
    JOLPICA reports a lapped finisher as "Lapped" where Ergast said "+1 Lap",
    and code that pattern-matches those strings to decide who finished drops a
    third of the field the day the wording changes. ClassifiedPosition is a
    number for everyone the stewards classified and a letter otherwise ("R"
    retired, "D" disqualified, "E" excluded, "W" withdrawn, "F" failed to
    qualify, "N" not classified), which is the distinction actually wanted.
    Status is kept alongside because "Collision" and "Gearbox" are worth
    showing, not because anything branches on it.

    gapSeconds is only populated for drivers on the lead lap. The feed's Time
    column holds the winner's total race time in P1 and a gap below it, but
    for a lapped driver that gap is measured to the car ahead on their own
    lap, not to the winner — Bahrain 2024 lists P11 at 6.759s, which as a
    race gap is meaningless. Left null rather than shown wrong.
    """
    schema = ["driver", "position", "classified", "grid", "status",
              "points", "sprintPoints", "gapSeconds"]

    winner_seconds = None
    rows = []
    for _, r in session.results.iterrows():
        classified = str(r.get("ClassifiedPosition") or "").strip()
        position = int(classified) if classified.isdigit() else None

        time = r.get("Time")
        seconds = None
        if time is not None and not pd.isna(time):
            seconds = time.total_seconds()
        if position == 1:
            winner_seconds = seconds

        status = str(r.get("Status") or "").strip()
        gap = 0.0 if position == 1 else (
            seconds if (seconds is not None and status == "Finished") else None
        )

        grid = r.get("GridPosition")
        points = r.get("Points")
        code = str(r.get("Abbreviation") or "")

        rows.append([
            code,
            position,
            classified or None,
            # A pit lane start is recorded as grid 0; kept as 0 rather than
            # normalised to last, because they are different things.
            int(grid) if grid is not None and not pd.isna(grid) else None,
            status or None,
            rounded(points, 2) if points is not None and not pd.isna(points) else None,
            rounded((sprint_points or {}).get(code), 2),
            rounded(gap, 3),
        ])

    rows.sort(key=lambda r: (r[1] is None, r[1] or 0))
    return schema, rows, rounded(winner_seconds, 3)


def build_sprint_points(session):
    """Driver code -> sprint points, for the championship running total."""
    points = {}
    for _, r in session.results.iterrows():
        p = r.get("Points")
        if p is not None and not pd.isna(p):
            points[str(r.get("Abbreviation") or "")] = float(p)
    return points


def fetch_circuit_index(season: int) -> dict:
    """
    Round -> stable circuit identity, from the results feed's schedule.

    The name a race runs under changes with its sponsor, and FastF1's Location
    string is not stable either: the same Miami track is "Miami" in 2024 and
    "Miami Gardens" from 2025, and Monaco is "Monaco" until 2026 and "Monte
    Carlo" after. Keying a circuit page on either one splits a track into two
    and destroys the season-to-season comparison the page exists for. The feed
    carries a circuitId that does not move ("miami", "monaco"), so that is the
    key, and it costs one request per season.
    """
    import json
    import urllib.request

    url = f"https://api.jolpi.ca/ergast/f1/{season}/races.json?limit=100"
    with urllib.request.urlopen(url, timeout=30) as response:
        races = json.load(response)["MRData"]["RaceTable"]["Races"]

    index = {}
    for race in races:
        circuit = race.get("Circuit") or {}
        location = circuit.get("Location") or {}
        index[int(race["round"])] = {
            "circuitId": circuit.get("circuitId"),
            "circuitName": circuit.get("circuitName"),
            "locality": location.get("locality"),
            "circuitCountry": location.get("country"),
        }
    return index
