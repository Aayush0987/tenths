"""
Telemetry: per-driver fastest-lap traces, and the mini-sector dominance that
the track map is drawn from.

Telemetry does not exist for every season. It is published from 2018 and is
absent for 2026 — a 2026 session raises DataNotLoadedError on access while a
2024 one returns several hundred rows. Callers get None and the app hides the
telemetry views for that race rather than breaking.
"""

from __future__ import annotations

import pandas as pd

from encoding import rounded
from extract import MINI_SECTORS, TELEMETRY_POINTS

CHANNELS = ["X", "Y", "Distance", "Speed", "Throttle", "Brake"]
SCHEMA = ["x", "y", "distance", "speed", "throttle", "brake"]


def _downsample(frame: pd.DataFrame, points: int) -> pd.DataFrame:
    stride = max(1, len(frame) // points)
    out = frame.iloc[::stride]
    # Always keep the final sample so the trace reaches the end of the lap.
    if len(frame) and out.index[-1] != frame.index[-1]:
        out = pd.concat([out, frame.iloc[[-1]]])
    return out


def build_telemetry(session, log=print):
    """
    Returns a payload dict, or None when the session publishes no telemetry.

    Each driver contributes their fastest lap only. Storing every lap would be
    two orders of magnitude more data for a view nobody asked for; the fastest
    lap is what a track map and a speed trace are about.
    """
    laps = session.laps
    if laps is None or laps.empty:
        return None

    traces = []
    dominance_speed: dict[str, list[float]] = {}

    for driver in sorted(laps["Driver"].dropna().unique()):
        try:
            lap = laps.pick_drivers(driver).pick_fastest()
            if lap is None or (isinstance(lap, float) and pd.isna(lap)):
                continue
            tel = lap.get_telemetry()
        except Exception:
            continue
        if tel is None or tel.empty or not all(c in tel for c in CHANNELS):
            continue

        lap_time = lap.get("LapTime")
        seconds = rounded(lap_time.total_seconds()) if lap_time is not None and not pd.isna(lap_time) else None

        ds = _downsample(tel[CHANNELS].dropna(), TELEMETRY_POINTS)
        if ds.empty:
            continue
        traces.append([
            str(driver),
            seconds,
            [[rounded(r.X, 1), rounded(r.Y, 1), rounded(r.Distance, 1),
              rounded(r.Speed, 1), rounded(r.Throttle, 0), rounded(r.Brake, 0)]
             for r in ds.itertuples()],
        ])

        # Mean speed per mini-sector, on the full trace rather than the
        # downsampled one — the bins are the point, so use every sample.
        full = tel[["Distance", "Speed"]].dropna()
        if full.empty:
            continue
        total = full["Distance"].max()
        if not total or total <= 0:
            continue
        bins = (full["Distance"] / total * MINI_SECTORS).clip(0, MINI_SECTORS - 1).astype(int)
        means = full.groupby(bins)["Speed"].mean()
        dominance_speed[str(driver)] = [rounded(means.get(i), 1) for i in range(MINI_SECTORS)]

    if not traces:
        return None

    # Fastest driver per mini-sector, by mean speed through it.
    fastest = []
    for i in range(MINI_SECTORS):
        best_driver, best_speed = None, None
        for driver, speeds in dominance_speed.items():
            s = speeds[i]
            if s is None:
                continue
            if best_speed is None or s > best_speed:
                best_driver, best_speed = driver, s
        fastest.append([i, best_driver, best_speed])

    # The track path comes from the outright fastest lap, each point tagged
    # with the mini-sector it falls in so the map can be coloured directly.
    reference = min(traces, key=lambda t: t[1] if t[1] is not None else 1e9)
    ref_total = max((p[2] for p in reference[2]), default=0) or 1
    path = [
        [p[0], p[1], min(MINI_SECTORS - 1, int(p[2] / ref_total * MINI_SECTORS))]
        for p in reference[2]
    ]

    log(f"    telemetry: {len(traces)} drivers, reference {reference[0]}")
    return {
        "reference": reference[0],
        "miniSectors": MINI_SECTORS,
        "schema": {"traces": SCHEMA, "path": ["x", "y", "miniSector"], "fastest": ["miniSector", "driver", "meanKph"]},
        "path": path,
        "fastest": fastest,
        "traces": traces,
    }
