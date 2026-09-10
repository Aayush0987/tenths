import type { RaceData } from "@/types/data";

export interface StartRow {
  driver: string;
  team: string;
  teamColor: string | null;
  /** Grid slot. Null for a pit lane start, which is not a slot. */
  grid: number | null;
  pitLaneStart: boolean;
  lap1: number | null;
  /** Positive means places gained by the end of lap 1. */
  gained: number | null;
}

/**
 * What each driver did off the line.
 *
 * Grid position against position at the end of lap one — the part of a race
 * that decides a good deal of it and that no broadcast ever quantifies.
 *
 * A pit lane start has no grid slot. Counting it as last place would credit
 * the driver with places they never lost, so those starts are shown but
 * excluded from the gained figure. A driver who did not complete lap one is
 * excluded too: they lost every place at once, and it says nothing about
 * their start.
 */
export function startPerformance(race: RaceData): StartRow[] {
  const info = new Map(race.drivers.map((d) => [d.code, d]));
  const grid = new Map(race.results.map((r) => [r.driver, r.grid]));

  const lap1 = new Map<string, number>();
  for (const lap of race.laps) {
    if (lap.lap === 1 && lap.position !== null) lap1.set(lap.driver, lap.position);
  }

  const rows: StartRow[] = [];
  for (const [driver, gridSlot] of grid) {
    const d = info.get(driver);
    const first = lap1.get(driver) ?? null;
    const pitLaneStart = gridSlot === 0;

    rows.push({
      driver,
      team: d?.team ?? "",
      teamColor: d?.teamColor ?? null,
      grid: pitLaneStart || gridSlot == null ? null : gridSlot,
      pitLaneStart,
      lap1: first,
      gained:
        pitLaneStart || gridSlot == null || first === null ? null : gridSlot - first,
    });
  }

  return rows.sort((a, b) => {
    if (a.gained === null && b.gained === null) return 0;
    if (a.gained === null) return 1;
    if (b.gained === null) return -1;
    return b.gained - a.gained || (a.grid ?? 99) - (b.grid ?? 99);
  });
}

export interface StartSummary {
  driver: string;
  team: string;
  teamColor: string | null;
  races: number;
  netGained: number;
  meanGained: number;
  bestGain: number;
  worstLoss: number;
}

/** The same thing across a set of races, for a season or a career. */
export function startSummary(races: RaceData[]): StartSummary[] {
  const totals = new Map<string, StartSummary & { sum: number }>();

  for (const race of races) {
    for (const row of startPerformance(race)) {
      if (row.gained === null) continue;
      const entry = totals.get(row.driver) ?? {
        driver: row.driver, team: row.team, teamColor: row.teamColor,
        races: 0, netGained: 0, meanGained: 0, bestGain: -99, worstLoss: 99, sum: 0,
      };
      entry.team = row.team;
      entry.teamColor = row.teamColor;
      entry.races += 1;
      entry.sum += row.gained;
      entry.bestGain = Math.max(entry.bestGain, row.gained);
      entry.worstLoss = Math.min(entry.worstLoss, row.gained);
      totals.set(row.driver, entry);
    }
  }

  return [...totals.values()]
    .map(({ sum, ...rest }) => ({
      ...rest,
      netGained: sum,
      meanGained: Number((sum / Math.max(1, rest.races)).toFixed(2)),
    }))
    .sort((a, b) => b.meanGained - a.meanGained);
}
