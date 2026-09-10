import type { DriverTrace, TelemetryPoint } from "@/types/data";

export interface ComparePoint {
  distance: number;
  /** Speed of each driver at this distance, km/h. */
  a: number | null;
  b: number | null;
  /**
   * Seconds the second driver is behind the first at this point. Positive
   * means the first driver is ahead.
   */
  delta: number | null;
}

export interface SectorVerdict {
  miniSector: number;
  /** Which driver was quicker through it, by elapsed time. */
  winner: "a" | "b" | null;
  gain: number;
}

export interface LapComparison {
  points: ComparePoint[];
  sectors: SectorVerdict[];
  lapA: number | null;
  lapB: number | null;
  /** Where each driver's advantage peaked, for annotating the delta chart. */
  maxDelta: number;
}

/** Linear interpolation of a channel at a given distance along the lap. */
function sampleAt(points: TelemetryPoint[], distance: number, channel: "speed" | "t"): number | null {
  if (points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if ((points[mid].distance ?? 0) <= distance) lo = mid;
    else hi = mid;
  }
  const p0 = points[lo];
  const p1 = points[hi];
  const d0 = p0.distance ?? 0;
  const d1 = p1.distance ?? 0;
  const v0 = p0[channel];
  const v1 = p1[channel];
  if (v0 === null) return v1;
  if (v1 === null) return v0;
  if (d1 === d0) return v0;
  const f = Math.min(1, Math.max(0, (distance - d0) / (d1 - d0)));
  return v0 + (v1 - v0) * f;
}

/**
 * Two laps put on a common axis.
 *
 * Comparison is by fraction of the lap, not by absolute metres, and that is
 * not a detail. Two drivers take different lines, so their laps measure
 * different lengths — at Bahrain 2024 Leclerc's covers 5380.1m and
 * Verstappen's 5366.3m. Comparing at the same metre mark means one of them is
 * still short of the line when the other has crossed it, which put the delta
 * at the end of the lap at +0.185s when the lap times differ by 0.014s.
 * Sampling each driver at the same proportion of their own lap makes the final
 * delta equal the lap-time difference, as it must.
 *
 * Distances are then reported on the reference driver's scale, which is also
 * the scale the track map is drawn on.
 *
 * Delta is a difference of lap-relative times, not an integral of speed, so it
 * does not accumulate error across the lap either.
 */
export function compareLaps(
  a: DriverTrace,
  b: DriverTrace,
  miniSectors: number,
  steps = 300,
): LapComparison {
  const totalA = Math.max(...a.points.map((p) => p.distance ?? 0));
  const totalB = Math.max(...b.points.map((p) => p.distance ?? 0));
  if (!Number.isFinite(totalA) || !Number.isFinite(totalB) || totalA <= 0 || totalB <= 0) {
    return { points: [], sectors: [], lapA: a.lapSeconds, lapB: b.lapSeconds, maxDelta: 0 };
  }

  const points: ComparePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const ta = sampleAt(a.points, totalA * f, "t");
    const tb = sampleAt(b.points, totalB * f, "t");
    points.push({
      distance: Number((totalA * f).toFixed(1)),
      a: sampleAt(a.points, totalA * f, "speed"),
      b: sampleAt(b.points, totalB * f, "speed"),
      delta: ta !== null && tb !== null ? Number((tb - ta).toFixed(3)) : null,
    });
  }

  // Who gained through each mini-sector, from elapsed time across it rather
  // than mean speed: a driver can carry more speed and still lose the section.
  const sectors: SectorVerdict[] = [];
  for (let s = 0; s < miniSectors; s++) {
    const fromF = s / miniSectors;
    const toF = (s + 1) / miniSectors;
    const aFrom = sampleAt(a.points, totalA * fromF, "t");
    const aTo = sampleAt(a.points, totalA * toF, "t");
    const bFrom = sampleAt(b.points, totalB * fromF, "t");
    const bTo = sampleAt(b.points, totalB * toF, "t");
    if (aFrom === null || aTo === null || bFrom === null || bTo === null) {
      sectors.push({ miniSector: s, winner: null, gain: 0 });
      continue;
    }
    const spent = { a: aTo - aFrom, b: bTo - bFrom };
    const gain = Number(Math.abs(spent.a - spent.b).toFixed(3));
    sectors.push({ miniSector: s, winner: spent.a < spent.b ? "a" : "b", gain });
  }

  const maxDelta = Math.max(0, ...points.map((p) => Math.abs(p.delta ?? 0)));
  return { points, sectors, lapA: a.lapSeconds, lapB: b.lapSeconds, maxDelta };
}
