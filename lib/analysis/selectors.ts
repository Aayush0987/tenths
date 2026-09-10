import type { Lap, Stint } from "@/types/data";

/**
 * Shared shaping over the flat lap table.
 *
 * The data file stores one row per driver-lap. Most analysis wants those
 * grouped, and — more importantly — wants the same definition of a lap worth
 * measuring. That definition was duplicated across charts in an earlier
 * version and is stated once here.
 */

/** Laps slower than this share of their stint's median are traffic, not pace. */
export const CLEAN_LAP_THRESHOLD = 1.07;

export function lapsByDriver(laps: Lap[]): Map<string, Lap[]> {
  const out = new Map<string, Lap[]>();
  for (const lap of laps) {
    const list = out.get(lap.driver);
    if (list) list.push(lap);
    else out.set(lap.driver, [lap]);
  }
  for (const list of out.values()) list.sort((a, b) => a.lap - b.lap);
  return out;
}

export function stintsByDriver(stints: Stint[]): Map<string, Stint[]> {
  const out = new Map<string, Stint[]>();
  for (const s of stints) {
    const list = out.get(s.driver);
    if (list) list.push(s);
    else out.set(s.driver, [s]);
  }
  for (const list of out.values()) list.sort((a, b) => a.stint - b.stint);
  return out;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function standardDeviation(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
}

/** Least-squares fit of y against x. */
export function fit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

export interface RacingLap {
  lap: number;
  seconds: number;
  /** Laps completed on this set, starting at 1. */
  age: number;
  stint: Stint;
}

/**
 * The laps of one stint that are about driving.
 *
 * Excludes the first and last lap of the stint, which contain pit lane time,
 * and anything beyond 107% of the stint's median, which is traffic, a safety
 * car or a mistake. Without those cuts a "pace" measure is really a measure of
 * how often a driver was held up.
 *
 * Lap 1 is dropped implicitly: it has no lap time, because a standing start is
 * not a flying lap.
 */
export function cleanStintLaps(driverLaps: Lap[], stint: Stint): RacingLap[] {
  const byLap = new Map(driverLaps.map((l) => [l.lap, l]));
  const from = stint.lapStart + 1;
  const to = stint.lapEnd - 1;
  if (to < from) return [];

  const laps: RacingLap[] = [];
  for (let n = from; n <= to; n++) {
    const lap = byLap.get(n);
    if (!lap || lap.seconds === null) continue;
    laps.push({ lap: n, seconds: lap.seconds, age: n - stint.lapStart + 1, stint });
  }
  if (laps.length < 3) return [];

  const cut = median(laps.map((l) => l.seconds)) * CLEAN_LAP_THRESHOLD;
  return laps.filter((l) => l.seconds <= cut);
}

/** Every clean racing lap a driver managed, across all their stints. */
export function cleanLapsFor(driverLaps: Lap[], stints: Stint[]): RacingLap[] {
  return stints.flatMap((s) => cleanStintLaps(driverLaps, s));
}
