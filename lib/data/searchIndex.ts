import "server-only";

import { cache } from "react";

import { getAllRaces, getCircuits, getDrivers } from "@/lib/data/aggregate";

export interface SearchEntry {
  /** Kind, used for the group label and the badge. */
  k: "driver" | "circuit" | "race" | "season";
  /** Title. */
  t: string;
  /** Subtitle. */
  s: string;
  /** Href. */
  h: string;
  /** Extra text matched against but not shown — codes, alternate names. */
  a?: string;
}

/**
 * Everything the command palette can jump to.
 *
 * Built once at build time and shipped whole, because it is small — a hundred
 * and something entries for three seasons — and because a search that has to
 * wait for a request is not a command palette. Field names are single letters:
 * this crosses to every page in the layout, so the property names would
 * otherwise be a meaningful share of its size.
 *
 * If the backfill to 2018 makes this too large to send on every page, the
 * answer is to load it on first open rather than to make it a server round
 * trip.
 */
export const getSearchIndex = cache(async function getSearchIndex(): Promise<SearchEntry[]> {
  const [drivers, circuits, races] = await Promise.all([
    getDrivers(),
    getCircuits(),
    getAllRaces(),
  ]);

  const entries: SearchEntry[] = [];

  for (const d of drivers) {
    entries.push({
      k: "driver",
      t: d.name,
      s: `${d.code} · ${d.team}`,
      h: `/driver/${d.code}`,
      a: d.code,
    });
  }

  for (const c of circuits) {
    entries.push({
      k: "circuit",
      t: c.location,
      s: `${c.country} · ${c.seasons.join(", ")}`,
      h: `/circuit/${encodeURIComponent(c.id)}`,
      // The race name and the feed's own circuit name are both things people
      // type — "Emilia Romagna" should find Imola.
      a: [c.raceName, c.circuitName, c.id].filter(Boolean).join(" "),
    });
  }

  const seasons = [...new Set(races.map((r) => r.season))].sort((a, b) => b - a);
  for (const season of seasons) {
    entries.push({
      k: "season",
      t: String(season),
      s: `${races.filter((r) => r.season === season).length} races`,
      h: `/${season}`,
    });
  }

  for (const race of [...races].sort((a, b) => b.season - a.season || b.round - a.round)) {
    entries.push({
      k: "race",
      t: `${race.raceName.replace(" Grand Prix", "")} ${race.season}`,
      s: `Round ${race.round} · ${race.location}`,
      h: `/${race.season}/${race.round}`,
      a: `${race.country} ${race.raceName}`,
    });
  }

  return entries;
});
