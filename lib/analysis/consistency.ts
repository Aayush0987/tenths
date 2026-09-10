import type { Lap, Stint } from "@/types/data";
import { cleanLapsFor, lapsByDriver, median, standardDeviation, stintsByDriver } from "@/lib/analysis/selectors";

export interface ConsistencyRow {
  driver: string;
  /** Standard deviation of clean lap times, in seconds. Lower is steadier. */
  deviation: number;
  medianSeconds: number;
  laps: number;
}

/** Below this a driver's spread is one or two laps, not a trait. */
const MIN_CLEAN_LAPS = 15;

/**
 * How steady each driver's race pace was — a different question from how fast
 * they were. A driver can be quick and erratic, or a tenth off and never vary,
 * and only one of those shows up in a finishing position.
 */
export function computeConsistency(laps: Lap[], stints: Stint[]): ConsistencyRow[] {
  const byDriver = lapsByDriver(laps);
  const stintsFor = stintsByDriver(stints);
  const rows: ConsistencyRow[] = [];

  for (const [driver, driverStints] of stintsFor) {
    const driverLaps = byDriver.get(driver);
    if (!driverLaps) continue;
    const clean = cleanLapsFor(driverLaps, driverStints).map((l) => l.seconds);
    if (clean.length < MIN_CLEAN_LAPS) continue;
    rows.push({
      driver,
      deviation: Number(standardDeviation(clean).toFixed(3)),
      medianSeconds: Number(median(clean).toFixed(3)),
      laps: clean.length,
    });
  }
  rows.sort((a, b) => a.deviation - b.deviation);
  return rows;
}
