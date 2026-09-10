import { cleanLapsFor } from "@/lib/analysis/selectors";
import { bestQualifyingSeconds, racePoints } from "@/lib/analysis/championship";
import type { RaceData, TelemetryData, TelemetryPoint } from "@/types/data";

/* ---------------------------------------------------------------------------
 * Geometry
 * ------------------------------------------------------------------------- */

export interface CircuitGeometry {
  /** Path in SVG coordinates: y negated, see below. */
  points: { x: number; y: number; braking: boolean; speed: number | null }[];
  /** Contiguous runs of the path, split where braking starts or stops. */
  runs: { braking: boolean; points: { x: number; y: number }[] }[];
  brakingZones: number;
  direction: "clockwise" | "anticlockwise";
  lapMetres: number | null;
  /** Where the lap begins, and the heading across the line. */
  start: { x: number; y: number; angle: number } | null;
  /** A point a little way into the lap, for the direction arrow. Kept clear
   *  of the start line so the two marks do not collide. */
  heading: { x: number; y: number; angle: number } | null;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Twice the signed area of the closed path.
 *
 * In a y-up frame a positive result means the path was traversed
 * anticlockwise. That the telemetry is y-up rather than screen-oriented is not
 * documented anywhere; it was established by computing this for all
 * twenty-four circuits and comparing against how they are actually raced,
 * which agrees on every one. It matters twice over: the direction reported
 * below depends on the sign, and an SVG drawn without negating y comes out
 * mirrored, which for a shape people recognise is simply wrong.
 */
function signedArea(points: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** A braking run shorter than this is sensor chatter, not a corner. */
const MIN_BRAKE_POINTS = 2;

export function circuitGeometry(telemetry: TelemetryData): CircuitGeometry | null {
  // The reference driver's trace rather than the `path` array, because it
  // carries brake and speed alongside x and y on the same points. `path` has
  // only position and mini-sector.
  const trace =
    telemetry.traces.find((t) => t.driver === telemetry.reference) ?? telemetry.traces[0];
  const raw = (trace?.points ?? []).filter(
    (p): p is TelemetryPoint & { x: number; y: number } => p.x !== null && p.y !== null,
  );
  if (raw.length < 20) return null;

  const area = signedArea(raw);

  // Negate y for SVG, whose y axis points down.
  const points = raw.map((p) => ({
    x: p.x,
    y: -p.y,
    braking: Boolean(p.brake),
    speed: p.speed,
  }));

  // Drop braking runs too short to be a corner, so the count means something.
  const cleaned = points.map((p) => ({ ...p }));
  let i = 0;
  let zones = 0;
  while (i < cleaned.length) {
    if (!cleaned[i].braking) { i += 1; continue; }
    let j = i;
    while (j < cleaned.length && cleaned[j].braking) j += 1;
    if (j - i < MIN_BRAKE_POINTS) {
      for (let k = i; k < j; k++) cleaned[k].braking = false;
    } else {
      zones += 1;
    }
    i = j;
  }

  const runs: CircuitGeometry["runs"] = [];
  for (const p of cleaned) {
    const last = runs[runs.length - 1];
    if (!last || last.braking !== p.braking) {
      const run = { braking: p.braking, points: [] as { x: number; y: number }[] };
      // Start each run at the previous one's last point so the road is
      // continuous rather than a dashed line with gaps at every corner.
      if (last) run.points.push(last.points[last.points.length - 1]);
      run.points.push({ x: p.x, y: p.y });
      runs.push(run);
    } else {
      last.points.push({ x: p.x, y: p.y });
    }
  }

  const distances = raw.map((p) => p.distance).filter((d): d is number => d !== null);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  // Heading is averaged over a span rather than taken from the next sample:
  // consecutive points are close enough together that GPS jitter alone can
  // swing the angle by tens of degrees, which tilted the start line.
  const angleAt = (index: number) => {
    const span = Math.max(2, Math.round(points.length * 0.02));
    const a = points[Math.max(0, index - span)];
    const b = points[Math.min(points.length - 1, index + span)];
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  };

  const head = points[0];
  const start = head ? { x: head.x, y: head.y, angle: angleAt(0) } : null;

  const arrowIndex = Math.round(points.length * 0.06);
  const arrowAt = points[arrowIndex];
  const heading = arrowAt
    ? { x: arrowAt.x, y: arrowAt.y, angle: angleAt(arrowIndex) }
    : null;

  return {
    points,
    runs,
    brakingZones: zones,
    direction: area > 0 ? "anticlockwise" : "clockwise",
    lapMetres: distances.length ? Math.max(...distances) : null,
    start,
    heading,
    bounds: {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    },
  };
}

/* ---------------------------------------------------------------------------
 * Character
 * ------------------------------------------------------------------------- */

export interface CircuitCharacter {
  season: number;
  referenceDriver: string;
  lapSeconds: number | null;
  lapMetres: number | null;
  fullThrottlePercent: number | null;
  brakingPercent: number | null;
  topSpeedKph: number | null;
  averageSpeedKph: number | null;
  brakingZones: number;
  direction: "clockwise" | "anticlockwise";
}

/** Throttle is reported 0–100 and sits just under 100 when pinned. */
const FULL_THROTTLE = 98;

/**
 * What kind of circuit this is, measured off the reference qualifying lap.
 *
 * The share of the lap at full throttle separates circuits more usefully than
 * a corner count does: Monza reads 74% and Monaco around half, which is the
 * whole difference between them in one number. Everything here is measured
 * from one lap by one driver, which is the point — it is a description of the
 * track, so it wants the lap least compromised by fuel, traffic and tyres.
 */
export function circuitCharacter(
  telemetry: TelemetryData,
  geometry: CircuitGeometry,
): CircuitCharacter {
  const trace =
    telemetry.traces.find((t) => t.driver === telemetry.reference) ?? telemetry.traces[0];
  const points = trace?.points ?? [];

  const throttle = points.map((p) => p.throttle).filter((v): v is number => v !== null);
  const brake = points.filter((p) => p.brake !== null);
  const speeds = points.map((p) => p.speed).filter((v): v is number => v !== null);

  const lapSeconds = trace?.lapSeconds ?? null;
  const lapMetres = geometry.lapMetres;

  return {
    season: telemetry.season,
    referenceDriver: trace?.driver ?? telemetry.reference,
    lapSeconds,
    lapMetres,
    fullThrottlePercent: throttle.length
      ? round1((throttle.filter((v) => v >= FULL_THROTTLE).length / throttle.length) * 100)
      : null,
    brakingPercent: brake.length
      ? round1((brake.filter((p) => p.brake).length / brake.length) * 100)
      : null,
    topSpeedKph: speeds.length ? Math.max(...speeds) : null,
    averageSpeedKph:
      lapSeconds && lapMetres ? round1((lapMetres / lapSeconds) * 3.6) : null,
    brakingZones: geometry.brakingZones,
    direction: geometry.direction,
  };
}

function round1(v: number): number {
  return Number(v.toFixed(1));
}

/* ---------------------------------------------------------------------------
 * Records
 * ------------------------------------------------------------------------- */

export interface CircuitRecords {
  fastestQualifying: { driver: string; seconds: number; season: number } | null;
  fastestRaceLap: { driver: string; seconds: number; season: number } | null;
  topSpeed: { driver: string; kph: number; season: number } | null;
  mostWins: { driver: string; count: number }[];
  mostPoles: { driver: string; count: number }[];
  largestMargin: { driver: string; seconds: number; season: number } | null;
  closestMargin: { driver: string; seconds: number; season: number } | null;
  highestAttrition: { season: number; finishers: number; entries: number } | null;
}

/**
 * Records across the seasons on file.
 *
 * These are records within this dataset, not all-time — a circuit that has run
 * since 1950 has a real lap record set long before 2024. The page says so
 * rather than implying otherwise.
 */
export function circuitRecords(races: RaceData[]): CircuitRecords {
  let fastestQualifying: CircuitRecords["fastestQualifying"] = null;
  let fastestRaceLap: CircuitRecords["fastestRaceLap"] = null;
  let topSpeed: CircuitRecords["topSpeed"] = null;
  let largestMargin: CircuitRecords["largestMargin"] = null;
  let closestMargin: CircuitRecords["closestMargin"] = null;
  let highestAttrition: CircuitRecords["highestAttrition"] = null;

  const wins = new Map<string, number>();
  const poles = new Map<string, number>();

  for (const race of races) {
    for (const q of race.qualifying) {
      const best = bestQualifyingSeconds(q);
      if (best && (!fastestQualifying || best.seconds < fastestQualifying.seconds)) {
        fastestQualifying = { driver: q.driver, seconds: best.seconds, season: race.season };
      }
    }

    for (const driver of race.drivers) {
      const laps = race.laps.filter((l) => l.driver === driver.code);
      const stints = race.stints.filter((s) => s.driver === driver.code);
      for (const lap of cleanLapsFor(laps, stints)) {
        if (!fastestRaceLap || lap.seconds < fastestRaceLap.seconds) {
          fastestRaceLap = { driver: driver.code, seconds: lap.seconds, season: race.season };
        }
      }
    }

    for (const s of race.sectors) {
      if (s.speedTrapKph !== null && (!topSpeed || s.speedTrapKph > topSpeed.kph)) {
        topSpeed = { driver: s.driver, kph: s.speedTrapKph, season: race.season };
      }
    }

    const winner = race.results.find((r) => r.position === 1);
    if (winner) wins.set(winner.driver, (wins.get(winner.driver) ?? 0) + 1);

    const pole = race.qualifying.find((q) => q.position === 1);
    if (pole) poles.set(pole.driver, (poles.get(pole.driver) ?? 0) + 1);

    // The margin is the runner-up's gap, which exists only when they finished
    // on the lead lap. A win under the safety car reports no gap at all.
    const second = race.results.find((r) => r.position === 2);
    if (winner && second?.gapSeconds != null && second.gapSeconds > 0) {
      const entry = { driver: winner.driver, seconds: second.gapSeconds, season: race.season };
      if (!largestMargin || entry.seconds > largestMargin.seconds) largestMargin = entry;
      if (!closestMargin || entry.seconds < closestMargin.seconds) closestMargin = entry;
    }

    const finishers = race.results.filter((r) => r.position !== null).length;
    const entries = race.results.length;
    if (entries > 0 && (!highestAttrition || finishers - entries < highestAttrition.finishers - highestAttrition.entries)) {
      highestAttrition = { season: race.season, finishers, entries };
    }
  }

  const rank = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([driver, count]) => ({ driver, count }))
      .sort((a, b) => b.count - a.count || a.driver.localeCompare(b.driver))
      .filter((e, _, all) => e.count === all[0].count);

  return {
    fastestQualifying, fastestRaceLap, topSpeed,
    mostWins: rank(wins), mostPoles: rank(poles),
    largestMargin, closestMargin, highestAttrition,
  };
}

/** Points scored at this circuit, for the "who owns this track" question. */
export function circuitPointsLeaders(races: RaceData[], limit = 5) {
  const totals = new Map<string, { points: number; starts: number; best: number | null }>();
  for (const race of races) {
    for (const result of race.results) {
      const entry = totals.get(result.driver) ?? { points: 0, starts: 0, best: null };
      entry.points += racePoints(result);
      entry.starts += 1;
      if (result.position !== null) {
        entry.best = entry.best === null ? result.position : Math.min(entry.best, result.position);
      }
      totals.set(result.driver, entry);
    }
  }
  return [...totals.entries()]
    .map(([driver, v]) => ({ driver, ...v }))
    .sort((a, b) => b.points - a.points || (a.best ?? 99) - (b.best ?? 99))
    .slice(0, limit);
}
