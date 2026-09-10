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

export interface RaceData {
  v: number;
  season: number;
  round: number;
  raceName: string;
  location: string;
  country: string;
  date: string | null;
  totalLaps: number;
  drivers: Driver[];
  laps: Lap[];
  stints: Stint[];
  pitStops: PitStop[];
  sectors: SectorBests[];
  qualifying: QualifyingResult[];
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
    date: string | null;
    totalLaps: number;
    hasTelemetry: boolean;
  }[];
  generatedAt: string;
}
