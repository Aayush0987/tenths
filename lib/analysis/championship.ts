import type { RaceData, RaceResult } from "@/types/data";
import { parseLapTime } from "@/lib/format";

/** Points a driver scored in one race, sprint included. */
export function racePoints(result: RaceResult): number {
  return (result.points ?? 0) + (result.sprintPoints ?? 0);
}

export interface StandingRow {
  code: string;
  name: string;
  team: string;
  teamColor: string | null;
  points: number;
  /** Cumulative total after each round, aligned to `rounds`. */
  running: number[];
  wins: number;
  podiums: number;
  poles: number;
  /** Rounds started. Not every driver contests every round. */
  starts: number;
  dnfs: number;
  bestFinish: number | null;
}

export interface Standings {
  rounds: number[];
  drivers: StandingRow[];
  constructors: {
    team: string;
    teamColor: string | null;
    points: number;
    running: number[];
    drivers: string[];
  }[];
}

/**
 * Championship standings, round by round.
 *
 * Points include sprints. The running total carries forward across rounds a
 * driver missed rather than resetting or gapping, so a line chart of it never
 * dives to zero for an absent driver — which would read as losing a
 * championship rather than skipping a race.
 *
 * This counts points as the results feed reports them. It does not model
 * post-race appeals that moved points weeks later, and it has no opinion on
 * the years where a dropped-scores rule applied.
 */
export function buildStandings(races: RaceData[]): Standings {
  const ordered = [...races].sort((a, b) => a.round - b.round);
  const rounds = ordered.map((r) => r.round);

  const rows = new Map<string, StandingRow>();
  const teamsOf = new Map<string, { color: string | null; drivers: Set<string> }>();

  for (let i = 0; i < ordered.length; i++) {
    const race = ordered[i];
    const driverInfo = new Map(race.drivers.map((d) => [d.code, d]));
    const poleSitter = race.qualifying.find((q) => q.position === 1)?.driver;

    for (const result of race.results) {
      const info = driverInfo.get(result.driver);
      let row = rows.get(result.driver);
      if (!row) {
        row = {
          code: result.driver,
          name: info?.name ?? result.driver,
          team: info?.team ?? "",
          teamColor: info?.teamColor ?? null,
          points: 0,
          // Back-fill the rounds before this driver's first appearance with
          // zero, so every row is the same length as `rounds`.
          running: new Array(i).fill(0),
          wins: 0, podiums: 0, poles: 0, starts: 0, dnfs: 0,
          bestFinish: null,
        };
        rows.set(result.driver, row);
      }

      if (info) {
        row.team = info.team;
        row.teamColor = info.teamColor;
      }

      row.points += racePoints(result);
      row.starts += 1;
      if (result.position === 1) row.wins += 1;
      if (result.position !== null && result.position <= 3) row.podiums += 1;
      if (result.position === null) row.dnfs += 1;
      if (result.position !== null) {
        row.bestFinish = row.bestFinish === null
          ? result.position
          : Math.min(row.bestFinish, result.position);
      }
      if (poleSitter && poleSitter === result.driver) row.poles += 1;

      const team = info?.team;
      if (team) {
        const entry = teamsOf.get(team) ?? { color: info?.teamColor ?? null, drivers: new Set() };
        entry.color = info?.teamColor ?? entry.color;
        entry.drivers.add(result.driver);
        teamsOf.set(team, entry);
      }
    }

    // Close the round for everyone, present or not: a driver who missed it
    // keeps the total they had rather than dropping out of the series.
    for (const row of rows.values()) {
      row.running[i] = row.points;
      for (let j = 0; j < i; j++) if (row.running[j] === undefined) row.running[j] = 0;
    }
  }

  const drivers = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.bestFinish ?? 99) - (b.bestFinish ?? 99),
  );

  const constructors = [...teamsOf.entries()]
    .map(([team, entry]) => {
      const members = drivers.filter((d) => entry.drivers.has(d.code));
      const running = rounds.map((_, i) =>
        members.reduce((sum, d) => sum + (d.running[i] ?? 0), 0),
      );
      return {
        team,
        teamColor: entry.color,
        points: running[running.length - 1] ?? 0,
        running,
        drivers: members.map((d) => d.code),
      };
    })
    .sort((a, b) => b.points - a.points);

  return { rounds, drivers, constructors };
}

export interface TeammateComparison {
  code: string;
  teammate: string;
  team: string;
  /** Rounds where both drivers were classified as starting. */
  shared: number;
  qualifyingWins: number;
  qualifyingLosses: number;
  raceWins: number;
  raceLosses: number;
  /** Mean qualifying gap in seconds; positive means slower than the teammate. */
  medianQualifyingGap: number | null;
}

/**
 * Head-to-head against teammates.
 *
 * Only rounds where both drivers took part count, and `shared` is reported
 * alongside every tally. Mid-season swaps are common — 2024 alone had Ferrari
 * run three drivers in one seat and RB run two — and an unqualified "14-8"
 * built on a five-race denominator says nothing. Races where either driver
 * failed to be classified are excluded from the race tally, because a
 * comparison decided by someone's gearbox is not a comparison of drivers.
 */
export function teammateComparisons(
  races: RaceData[],
  code: string,
): TeammateComparison[] {
  const byTeammate = new Map<string, TeammateComparison & { gaps: number[] }>();

  for (const race of races) {
    const self = race.drivers.find((d) => d.code === code);
    if (!self) continue;

    const mates = race.drivers.filter((d) => d.team === self.team && d.code !== code);
    for (const mate of mates) {
      const key = `${self.team}|${mate.code}`;
      const entry = byTeammate.get(key) ?? {
        code, teammate: mate.code, team: self.team, shared: 0,
        qualifyingWins: 0, qualifyingLosses: 0, raceWins: 0, raceLosses: 0,
        medianQualifyingGap: null, gaps: [],
      };

      const selfResult = race.results.find((r) => r.driver === code);
      const mateResult = race.results.find((r) => r.driver === mate.code);
      if (!selfResult || !mateResult) continue;
      entry.shared += 1;

      const selfQ = race.qualifying.find((q) => q.driver === code);
      const mateQ = race.qualifying.find((q) => q.driver === mate.code);
      if (selfQ?.position != null && mateQ?.position != null) {
        if (selfQ.position < mateQ.position) entry.qualifyingWins += 1;
        else entry.qualifyingLosses += 1;

        const a = bestQualifyingSeconds(selfQ);
        const b = bestQualifyingSeconds(mateQ);
        // Only compare times set in the same segment: a Q2 lap and a Q3 lap
        // are run on different fuel and a different track, so the difference
        // between them is not a gap between the drivers.
        if (a && b && a.segment === b.segment) entry.gaps.push(a.seconds - b.seconds);
      }

      if (selfResult.position !== null && mateResult.position !== null) {
        if (selfResult.position < mateResult.position) entry.raceWins += 1;
        else entry.raceLosses += 1;
      }

      byTeammate.set(key, entry);
    }
  }

  return [...byTeammate.values()]
    .map(({ gaps, ...rest }) => ({
      ...rest,
      medianQualifyingGap: gaps.length ? medianOf(gaps) : null,
    }))
    .sort((a, b) => b.shared - a.shared);
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number(m.toFixed(3));
}

/** The driver's best lap of qualifying, and which segment set it. */
export function bestQualifyingSeconds(
  q: { q1: string | null; q2: string | null; q3: string | null },
): { seconds: number; segment: "q1" | "q2" | "q3" } | null {
  for (const segment of ["q3", "q2", "q1"] as const) {
    const parsed = parseLapTime(q[segment]);
    if (parsed !== null) return { seconds: parsed, segment };
  }
  return null;
}
