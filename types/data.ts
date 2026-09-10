/**
 * Decoded shapes of the precomputed data.
 *
 * Files on disk are arrays of tuples; these are what the app sees after
 * lib/data/decode.ts expands them. Field order lives in each file's `schema`
 * and is checked at decode time, so a pipeline change that reorders a table
 * fails loudly instead of silently shifting every value one column over.
 */

export type Compound =
  | "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET" | "UNKNOWN";

export interface Driver {
  code: string;
  number: string;
  name: string;
  team: string;
  teamColor: string | null;
}

export interface Lap {
  driver: string;
  lap: number;
  /** Null on lap 1 — a standing start is not a flying lap. */
  seconds: number | null;
  /** Session clock at the end of the lap. Present on every lap, including 1. */
  clock: number | null;
  compound: Compound | null;
  stint: number | null;
  position: number | null;
}

export interface Stint {
  driver: string;
  stint: number;
  compound: Compound;
  lapStart: number;
  lapEnd: number;
  laps: number;
  fresh: boolean | null;
}

export interface PitStop {
  driver: string;
  lap: number;
  /** Total pit lane time, not the stationary time quoted on television. */
  pitLaneSeconds: number | null;
}

export interface SectorBests {
  driver: string;
  s1: number;
  s2: number;
  s3: number;
  speedTrapKph: number | null;
}

export interface QualifyingResult {
  driver: string;
  position: number | null;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export interface RaceControlMessage {
  lap: number | null;
  category: string;
  flag: string | null;
  scope: string | null;
  message: string;
}

export interface WeatherSample {
  minutes: number | null;
  airTemp: number | null;
  trackTemp: number | null;
  humidity: number | null;
  windSpeed: number | null;
  rain: boolean | null;
}

export interface RaceResult {
  driver: string;
  /**
   * Classified finishing position, or null for anyone the stewards did not
   * classify. Derived from ClassifiedPosition, never from the status text —
   * see build_results in scripts/extract.py.
   */
  position: number | null;
  /** Raw classification: a number, or "R" retired, "D" disqualified, etc. */
  classified: string | null;
  /** 0 means a pit lane start, which is not the same as starting last. */
  grid: number | null;
  status: string | null;
  points: number | null;
  sprintPoints: number | null;
  /** Gap to the winner. Null for anyone not on the lead lap — the feed's
   *  figure for a lapped car is measured to the car ahead, not the winner. */
  gapSeconds: number | null;
}

export interface RaceData {
  v: number;
  season: number;
  round: number;
  raceName: string;
  location: string;
  country: string;
  /**
   * Stable circuit key from the results feed. The race name moves with its
   * sponsor and the location string moves too — the same Miami track is
   * "Miami" in 2024 and "Miami Gardens" after — so this is what a circuit is
   * grouped by. Null only for a file written before the pipeline carried it.
   */
  circuitId: string | null;
  circuitName: string | null;
  date: string | null;
  totalLaps: number;
  drivers: Driver[];
  laps: Lap[];
  stints: Stint[];
  pitStops: PitStop[];
  sectors: SectorBests[];
  qualifying: QualifyingResult[];
  results: RaceResult[];
  /** Winner's total race time, seconds. */
  winnerSeconds: number | null;
  raceControl: RaceControlMessage[];
  weather: WeatherSample[];
  generatedAt: string;
  source: string;
}

export interface TelemetryPoint {
  x: number | null;
  y: number | null;
  distance: number | null;
  speed: number | null;
  throttle: number | null;
  brake: number | null;
  /** Seconds since the start of the lap. Lap-relative, so two drivers'
   *  traces can be differenced directly. */
  t: number | null;
}

export interface DriverTrace {
  driver: string;
  lapSeconds: number | null;
  points: TelemetryPoint[];
}

export interface TrackPathPoint {
  x: number | null;
  y: number | null;
  miniSector: number;
}

export interface MiniSectorBest {
  miniSector: number;
  driver: string | null;
  meanKph: number | null;
}

export interface TelemetryData {
  v: number;
  season: number;
  round: number;
  /** Driver whose lap defines the track path — the outright fastest of
   *  qualifying, which is not always the pole lap. */
  reference: string;
  miniSectors: number;
  path: TrackPathPoint[];
  /** Noisy across all twenty drivers; the meaningful comparison is a pair. */
  fastest: MiniSectorBest[];
  traces: DriverTrace[];
}

export interface SeasonIndex {
  season: number;
  races: {
    round: number;
    raceName: string;
    location: string;
    country: string;
    circuitId: string | null;
    date: string | null;
    totalLaps: number;
    hasTelemetry: boolean;
  }[];
  generatedAt: string;
}
