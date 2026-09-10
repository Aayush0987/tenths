import { parseLapTime } from "@/lib/format";
import type { QualifyingResult, RaceData } from "@/types/data";

export type Segment = "q1" | "q2" | "q3";

export interface CutlineDriver {
  driver: string;
  team: string;
  teamColor: string | null;
  seconds: number;
  label: string;
  /** Rank within this segment, 1 being quickest. */
  rank: number;
  /** Behind the quickest lap of this segment. */
  gapToBest: number;
  /**
   * Seconds off the last car to advance. Negative for those who went through,
   * positive for those who did not — how close the miss was.
   */
  gapToCut: number | null;
  advanced: boolean;
}

export interface CutlineSegment {
  segment: Segment;
  label: string;
  /** How many cars go through. Null in the final segment, where none are cut. */
  advances: number | null;
  drivers: CutlineDriver[];
  /** The time that had to be beaten to survive. */
  cutSeconds: number | null;
}

/**
 * Qualifying as three eliminations.
 *
 * The number that advances is read from the session rather than assumed: the
 * fifteen-and-ten split has been the format for years, but a session where
 * cars fail to set a time produces a shorter list, and hard-coding the split
 * would draw the cut line in the wrong place. The line sits after however
 * many drivers actually appear in the next segment.
 *
 * Only drivers who set a time appear. Someone who did not run in Q1 has no
 * qualifying performance to rank, and putting them last would read as a slow
 * lap rather than no lap.
 */
export function buildCutline(race: RaceData): CutlineSegment[] {
  const info = new Map(race.drivers.map((d) => [d.code, d]));

  const ran = (segment: Segment) =>
    race.qualifying.filter((q) => parseLapTime(q[segment]) !== null);

  const counts: Record<Segment, number> = {
    q1: ran("q1").length,
    q2: ran("q2").length,
    q3: ran("q3").length,
  };

  const segments: { segment: Segment; label: string; advances: number | null }[] = [
    { segment: "q1", label: "Q1", advances: counts.q2 || null },
    { segment: "q2", label: "Q2", advances: counts.q3 || null },
    { segment: "q3", label: "Q3", advances: null },
  ];

  return segments
    .filter((s) => counts[s.segment] > 0)
    .map(({ segment, label, advances }) => {
      const timed = ran(segment)
        .map((q: QualifyingResult) => ({
          q,
          seconds: parseLapTime(q[segment]) as number,
        }))
        .sort((a, b) => a.seconds - b.seconds);

      const best = timed[0]?.seconds ?? 0;
      const cutSeconds =
        advances !== null && timed[advances - 1] ? timed[advances - 1].seconds : null;

      const drivers: CutlineDriver[] = timed.map((entry, i) => {
        const d = info.get(entry.q.driver);
        return {
          driver: entry.q.driver,
          team: d?.team ?? "",
          teamColor: d?.teamColor ?? null,
          seconds: entry.seconds,
          label: entry.q[segment] ?? "",
          rank: i + 1,
          gapToBest: Number((entry.seconds - best).toFixed(3)),
          gapToCut:
            cutSeconds === null ? null : Number((entry.seconds - cutSeconds).toFixed(3)),
          advanced: advances === null ? true : i < advances,
        };
      });

      return { segment, label, advances, drivers, cutSeconds };
    });
}
