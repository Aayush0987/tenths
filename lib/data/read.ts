import "server-only";

import { readFile } from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import { cache } from "react";

import type {
  Compound, Driver, Lap, PitStop, QualifyingResult, RaceControlMessage,
  RaceData, SeasonIndex, SectorBests, Stint, TelemetryData, WeatherSample,
} from "@/types/data";
import { boolOrNull, decodeTable, num, numOrNull, str, strOrNull } from "@/lib/data/decode";

const gunzipAsync = promisify(gunzip);
const DATA_DIR = path.join(process.cwd(), "data");

async function readJsonGz<T>(file: string): Promise<T | null> {
  try {
    const buf = await readFile(file);
    return JSON.parse((await gunzipAsync(buf)).toString("utf-8")) as T;
  } catch (err) {
    // A missing file is normal: not every round has run, and telemetry does
    // not exist before 2018 or for 2026. Anything else is worth surfacing.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[data] failed to read ${file}:`, err);
    }
    return null;
  }
}

interface RawRace {
  schema?: Record<string, string[]>;
  [key: string]: unknown;
}

/**
 * One race, decoded.
 *
 * Wrapped in React's cache so several components in a render can each ask for
 * it without re-reading and re-inflating the file.
 */
export const getRace = cache(async function getRace(
  season: number,
  round: number | string,
): Promise<RaceData | null> {
  const r = Number(round);
  if (!Number.isInteger(r) || r < 1) return null;

  const raw = await readJsonGz<RawRace>(path.join(DATA_DIR, String(season), `${r}.json.gz`));
  if (!raw) return null;
  const schema = raw.schema;

  return {
    v: num(raw.v),
    season: num(raw.season),
    round: num(raw.round),
    raceName: str(raw.raceName),
    location: str(raw.location),
    country: str(raw.country),
    date: strOrNull(raw.date),
    totalLaps: num(raw.totalLaps),
    generatedAt: str(raw.generatedAt),
    source: str(raw.source),

    drivers: decodeTable<Driver>("drivers", ["code", "number", "name", "team", "teamColor"],
      schema, raw.drivers as never, (g) => ({
        code: str(g("code")), number: str(g("number")), name: str(g("name")),
        team: str(g("team")), teamColor: strOrNull(g("teamColor")),
      })),

    laps: decodeTable<Lap>("laps", ["driver", "lap", "seconds", "clock", "compound", "stint", "position"],
      schema, raw.laps as never, (g) => ({
        driver: str(g("driver")), lap: num(g("lap")),
        seconds: numOrNull(g("seconds")), clock: numOrNull(g("clock")),
        compound: (strOrNull(g("compound")) as Compound | null),
        stint: numOrNull(g("stint")), position: numOrNull(g("position")),
      })),

    stints: decodeTable<Stint>("stints", ["driver", "stint", "compound", "lapStart", "lapEnd", "laps", "fresh"],
      schema, raw.stints as never, (g) => ({
        driver: str(g("driver")), stint: num(g("stint")),
        compound: str(g("compound")) as Compound,
        lapStart: num(g("lapStart")), lapEnd: num(g("lapEnd")), laps: num(g("laps")),
        fresh: boolOrNull(g("fresh")),
      })),

    pitStops: decodeTable<PitStop>("pitStops", ["driver", "lap", "pitLaneSeconds"],
      schema, raw.pitStops as never, (g) => ({
        driver: str(g("driver")), lap: num(g("lap")),
        pitLaneSeconds: numOrNull(g("pitLaneSeconds")),
      })),

    sectors: decodeTable<SectorBests>("sectors", ["driver", "s1", "s2", "s3", "speedTrapKph"],
      schema, raw.sectors as never, (g) => ({
        driver: str(g("driver")), s1: num(g("s1")), s2: num(g("s2")), s3: num(g("s3")),
        speedTrapKph: numOrNull(g("speedTrapKph")),
      })),

    qualifying: decodeTable<QualifyingResult>("qualifying", ["driver", "position", "q1", "q2", "q3"],
      schema, raw.qualifying as never, (g) => ({
        driver: str(g("driver")), position: numOrNull(g("position")),
        q1: strOrNull(g("q1")), q2: strOrNull(g("q2")), q3: strOrNull(g("q3")),
      })),

    raceControl: decodeTable<RaceControlMessage>("raceControl", ["lap", "category", "flag", "scope", "message"],
      schema, raw.raceControl as never, (g) => ({
        lap: numOrNull(g("lap")), category: str(g("category")),
        flag: strOrNull(g("flag")), scope: strOrNull(g("scope")), message: str(g("message")),
      })),

    weather: decodeTable<WeatherSample>("weather", ["minutes", "airTemp", "trackTemp", "humidity", "windSpeed", "rain"],
      schema, raw.weather as never, (g) => ({
        minutes: numOrNull(g("minutes")), airTemp: numOrNull(g("airTemp")),
        trackTemp: numOrNull(g("trackTemp")), humidity: numOrNull(g("humidity")),
        windSpeed: numOrNull(g("windSpeed")), rain: boolOrNull(g("rain")),
      })),
  };
});

interface RawTelemetry {
  schema?: { traces: string[]; path: string[]; fastest: string[] };
  [key: string]: unknown;
}

/** Qualifying telemetry for a race, or null where the season publishes none. */
export const getTelemetry = cache(async function getTelemetry(
  season: number,
  round: number | string,
): Promise<TelemetryData | null> {
  const r = Number(round);
  if (!Number.isInteger(r) || r < 1) return null;

  const raw = await readJsonGz<RawTelemetry>(
    path.join(DATA_DIR, String(season), `${r}.tel.json.gz`),
  );
  if (!raw) return null;

  const traceFields = raw.schema?.traces ?? [];
  const expected = ["x", "y", "distance", "speed", "throttle", "brake"];
  if (traceFields.join(",") !== expected.join(",")) {
    console.warn(`[data] telemetry trace schema mismatch in ${season}/${r}`);
    return null;
  }
  const at = (p: unknown[], f: string) => numOrNull(p[expected.indexOf(f)]);

  return {
    v: num(raw.v), season: num(raw.season), round: num(raw.round),
    reference: str(raw.reference), miniSectors: num(raw.miniSectors),
    path: ((raw.path as unknown[][]) ?? []).map((p) => ({
      x: numOrNull(p[0]), y: numOrNull(p[1]), miniSector: num(p[2]),
    })),
    fastest: ((raw.fastest as unknown[][]) ?? []).map((f) => ({
      miniSector: num(f[0]), driver: strOrNull(f[1]), meanKph: numOrNull(f[2]),
    })),
    traces: ((raw.traces as unknown[][]) ?? []).map((t) => ({
      driver: str(t[0]),
      lapSeconds: numOrNull(t[1]),
      points: ((t[2] as unknown[][]) ?? []).map((p) => ({
        x: at(p, "x"), y: at(p, "y"), distance: at(p, "distance"),
        speed: at(p, "speed"), throttle: at(p, "throttle"), brake: at(p, "brake"),
      })),
    })),
  };
});

export const getSeasonIndex = cache(async function getSeasonIndex(
  season: number,
): Promise<SeasonIndex | null> {
  try {
    const file = path.join(DATA_DIR, String(season), "index.json");
    return JSON.parse(await readFile(file, "utf-8")) as SeasonIndex;
  } catch {
    return null;
  }
});
