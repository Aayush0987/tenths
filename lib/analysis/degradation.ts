import type { Compound, Lap, Stint } from "@/types/data";
import { cleanStintLaps, fit, lapsByDriver, median, stintsByDriver } from "@/lib/analysis/selectors";

export interface DegradationPoint {
  age: number;
  [compound: string]: number | undefined;
}

export interface CompoundSummary {
  compound: Compound;
  /** Seconds lost per lap, from a least-squares fit over the medians. */
  slope: number;
  intercept: number;
  laps: number;
  maxAge: number;
}

export interface Degradation {
  points: DegradationPoint[];
  summaries: CompoundSummary[];
}

const MIN_LAPS_PER_COMPOUND = 30;
/** Long stints are rare; without a floor the tail is one driver's noise. */
const MIN_STINTS_PER_AGE = 6;

/**
 * How far off its own best a stint runs as the set ages.
 *
 * Plotting against tyre age rather than lap number is what makes stints
 * comparable — every set starts at age 1 whenever it was fitted.
 *
 * Values are seconds off each stint's own best clean lap, not absolute times.
 * That is not cosmetic: a car sheds fuel through a race, so a soft stint run
 * at the end looks quick because the car is light. Measuring raw medians once
 * made the softs fastest at 26 laps old, which is nonsense. There is still no
 * fuel correction within a stint, so a long run's wear is understated — a
 * caveat the chart states rather than hides.
 */
export function computeDegradation(laps: Lap[], stints: Stint[]): Degradation {
  const byDriver = lapsByDriver(laps);
  const stintsFor = stintsByDriver(stints);

  const buckets = new Map<Compound, Map<number, number[]>>();
  const lapCount = new Map<Compound, number>();

  for (const [driver, driverStints] of stintsFor) {
    const driverLaps = byDriver.get(driver);
    if (!driverLaps) continue;

    for (const stint of driverStints) {
      const clean = cleanStintLaps(driverLaps, stint);
      if (clean.length < 3) continue;

      // Reference each stint to its own best, which removes the fuel offset
      // between stints run at different points in the race.
      const reference = Math.min(...clean.map((l) => l.seconds));
      let ages = buckets.get(stint.compound);
      if (!ages) {
        ages = new Map();
        buckets.set(stint.compound, ages);
      }
      for (const l of clean) {
        const list = ages.get(l.age) ?? [];
        list.push(Number((l.seconds - reference).toFixed(3)));
        ages.set(l.age, list);
      }
      lapCount.set(stint.compound, (lapCount.get(stint.compound) ?? 0) + clean.length);
    }
  }

  const compounds = [...buckets.keys()].filter(
    (c) => (lapCount.get(c) ?? 0) >= MIN_LAPS_PER_COMPOUND,
  );
  if (compounds.length === 0) return { points: [], summaries: [] };

  const maxAge = Math.max(...compounds.flatMap((c) => [...(buckets.get(c)?.keys() ?? [])]));
  const points: DegradationPoint[] = [];
  for (let age = 1; age <= maxAge; age++) {
    const point: DegradationPoint = { age };
    let any = false;
    for (const c of compounds) {
      const vals = buckets.get(c)?.get(age);
      if (vals && vals.length >= MIN_STINTS_PER_AGE) {
        point[c] = Number(median(vals).toFixed(3));
        any = true;
      }
    }
    if (any) points.push(point);
  }

  const summaries: CompoundSummary[] = compounds
    .map((compound) => {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const p of points) {
        const v = p[compound];
        if (typeof v === "number") {
          xs.push(p.age);
          ys.push(v);
        }
      }
      const line = fit(xs, ys);
      return {
        compound,
        slope: Number(line.slope.toFixed(4)),
        intercept: Number(line.intercept.toFixed(4)),
        laps: lapCount.get(compound) ?? 0,
        maxAge: xs.length ? Math.max(...xs) : 0,
      };
    })
    .filter((s) => s.maxAge > 0)
    .sort((a, b) => b.slope - a.slope);

  // The fitted value at each age, so the chart can draw the trend as a line
  // over the medians rather than joining the noise.
  for (const p of points) {
    for (const s of summaries) {
      if (typeof p[s.compound] === "number") {
        p[`${s.compound}_fit`] = Number((s.intercept + s.slope * p.age).toFixed(3));
      }
    }
  }

  return { points, summaries };
}
