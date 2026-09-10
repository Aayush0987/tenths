import type { Lap } from "@/types/data";

export interface GapRow {
  lap: number;
  [driver: string]: number | undefined;
}

export interface GapResult {
  rows: GapRow[];
  drivers: string[];
  maxGap: number;
  clamped: number;
}

/**
 * Gap to the leader, lap by lap, in seconds.
 *
 * Derived from each lap's session clock, never from summed lap times: no lap
 * time is recorded for lap 1, so summing makes the whole field appear level at
 * lap 2 and erases the spread the start produced.
 *
 * The leader at a lap is whoever holds the lowest clock on it — the leader on
 * the road at that moment, not the eventual winner.
 *
 * Gaps past `clampSeconds` are dropped. Once a driver is lapped their gap
 * jumps by a whole lap time, and an axis stretched to fit that flattens the
 * fight at the front into a few pixels.
 */
export function computeGapToLeader(laps: Lap[], clampSeconds = 90): GapResult {
  const byLap = new Map<number, { driver: string; clock: number }[]>();
  for (const lap of laps) {
    if (lap.clock === null) continue;
    const list = byLap.get(lap.lap) ?? [];
    list.push({ driver: lap.driver, clock: lap.clock });
    byLap.set(lap.lap, list);
  }

  const rows: GapRow[] = [];
  const seen = new Set<string>();
  let maxGap = 0;
  let clamped = 0;

  for (const lapNo of [...byLap.keys()].sort((a, b) => a - b)) {
    const entries = byLap.get(lapNo)!;
    const leader = Math.min(...entries.map((e) => e.clock));
    const row: GapRow = { lap: lapNo };
    let any = false;
    for (const e of entries) {
      const gap = Number((e.clock - leader).toFixed(2));
      if (gap > clampSeconds) {
        clamped++;
        continue;
      }
      row[e.driver] = gap;
      seen.add(e.driver);
      if (gap > maxGap) maxGap = gap;
      any = true;
    }
    if (any) rows.push(row);
  }

  const lastGap = new Map<string, number>();
  for (const row of rows) {
    for (const d of seen) {
      const v = row[d];
      if (typeof v === "number") lastGap.set(d, v);
    }
  }
  const drivers = [...seen].sort((a, b) => (lastGap.get(a) ?? 999) - (lastGap.get(b) ?? 999));
  return { rows, drivers, maxGap, clamped };
}
