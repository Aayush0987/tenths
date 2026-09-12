import "server-only";

import { readdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import type { RaceData } from "@/types/data";
import { getRace, getSeasonIndex } from "@/lib/data/read";

export { getSeasonIndex };

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Seasons in the repository, newest first.
 *
 * Read from the directory rather than listed here. A hardcoded list is one
 * more thing to remember on the day a backfill lands, and forgetting it fails
 * silently — the data would be on disk and simply absent from every page.
 */
export const getSeasons = cache(async function getSeasons(): Promise<number[]> {
  try {
    const entries = await readdir(DATA_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))
      .map((e) => Number(e.name))
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
});

/**
 * Every race in a season, decoded.
 *
 * This reads and inflates two dozen files. It is wrapped in cache() so a page
 * that asks several questions of one season pays for it once, and every page
 * built on it is a server component, so the cost lands at build time rather
 * than on a request. If seasons back to 2018 make that too slow, the answer is
 * a precomputed season summary rather than reading these files lazily —
 * standings are cumulative and cannot be computed from a subset.
 */
export const getSeasonRaces = cache(async function getSeasonRaces(
  season: number,
): Promise<RaceData[]> {
  const index = await getSeasonIndex(season);
  if (!index) return [];

  const races = await Promise.all(
    index.races.map((r) => getRace(season, r.round)),
  );
  return races
    .filter((r): r is RaceData => r !== null)
    .sort((a, b) => a.round - b.round);
});

/** Every race across every season. Used by the driver and circuit pages. */
export const getAllRaces = cache(async function getAllRaces(): Promise<RaceData[]> {
  const seasons = await getSeasons();
  const perSeason = await Promise.all(seasons.map((s) => getSeasonRaces(s)));
  return perSeason.flat();
});

export interface DriverIdentity {
  code: string;
  name: string;
  /** Most recent team, for display. Drivers move mid-season. */
  team: string;
  teamColor: string | null;
  seasons: number[];
  races: number;
}

/**
 * Everyone who appears anywhere in the data.
 *
 * A driver's team is the last one they drove for, not the first — someone who
 * moves between seasons should be listed under where they ended up. That
 * requires walking the races oldest first and letting later ones overwrite:
 * getAllRaces is newest-season-first for display, and reading "last seen" off
 * that order silently yields the earliest team instead, which listed Sainz
 * under Ferrari two seasons after he left.
 */
export const getDrivers = cache(async function getDrivers(): Promise<DriverIdentity[]> {
  const races = [...(await getAllRaces())].sort(
    (a, b) => a.season - b.season || a.round - b.round,
  );
  const byCode = new Map<string, DriverIdentity>();

  for (const race of races) {
    for (const d of race.drivers) {
      const existing = byCode.get(d.code);
      if (!existing) {
        byCode.set(d.code, {
          code: d.code, name: d.name, team: d.team, teamColor: d.teamColor,
          seasons: [race.season], races: 1,
        });
        continue;
      }
      existing.races += 1;
      existing.team = d.team;
      existing.teamColor = d.teamColor;
      if (!existing.seasons.includes(race.season)) existing.seasons.push(race.season);
    }
  }

  return [...byCode.values()]
    .map((d) => ({ ...d, seasons: d.seasons.sort((a, b) => b - a) }))
    .sort((a, b) => b.races - a.races || a.code.localeCompare(b.code));
});

/**
 * The key a circuit is grouped by.
 *
 * Neither the race name nor the location string is stable across seasons. The
 * name follows the sponsor — Imola has run as both the Emilia Romagna and the
 * Made in Italy Grand Prix — and the location follows nothing in particular:
 * the same Miami track is "Miami" in 2024 and "Miami Gardens" from 2025, and
 * Monaco becomes "Monte Carlo" in 2026. Grouping on either splits one circuit
 * into two entries, each with a single season, which is precisely the
 * comparison the circuit page exists to make. circuitId comes from the results
 * feed and does not move.
 *
 * Falls back to the location for any file written before the pipeline carried
 * the identifier, so an un-backfilled race still resolves somewhere sensible.
 */
export function circuitKey(race: RaceData): string {
  return (race.circuitId ?? race.location).toLowerCase();
}

/** Races at one circuit, across seasons. */
export const getCircuitRaces = cache(async function getCircuitRaces(
  id: string,
): Promise<RaceData[]> {
  const races = await getAllRaces();
  const key = id.toLowerCase();
  return races
    .filter((r) => circuitKey(r) === key)
    .sort((a, b) => a.season - b.season);
});

export interface CircuitIdentity {
  id: string;
  /** Most recent location name; it changes between seasons. */
  location: string;
  country: string;
  /** Most recent name the race ran under. */
  raceName: string;
  /** The feed's full circuit name, where it has one. */
  circuitName: string | null;
  seasons: number[];
}

export const getCircuits = cache(async function getCircuits(): Promise<CircuitIdentity[]> {
  const races = await getAllRaces();
  const byId = new Map<string, CircuitIdentity>();

  for (const race of [...races].sort((a, b) => a.season - b.season)) {
    const key = circuitKey(race);
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, {
        id: key, location: race.location, country: race.country,
        raceName: race.raceName, circuitName: race.circuitName,
        seasons: [race.season],
      });
      continue;
    }
    // Later seasons win, so the page is titled by what the track is called now.
    existing.raceName = race.raceName;
    existing.location = race.location;
    existing.circuitName = race.circuitName ?? existing.circuitName;
    if (!existing.seasons.includes(race.season)) existing.seasons.push(race.season);
  }

  return [...byId.values()].sort((a, b) => a.location.localeCompare(b.location));
});
