import { bestQualifyingSeconds, racePoints } from "@/lib/analysis/championship";
import { startPerformance } from "@/lib/analysis/start";
import type { RaceData } from "@/types/data";

export interface RecordHolder {
  /** Driver code, or a team name where the record belongs to a team. */
  who: string;
  value: number;
  /** Preformatted, because a margin, a speed and a count read differently. */
  display: string;
  season: number;
  round: number;
  raceName: string;
  circuitId: string | null;
  detail?: string;
}

export interface RecordGroup {
  title: string;
  note: string;
  entries: { label: string; holders: RecordHolder[]; ascending?: boolean }[];
}

/**
 * Site-wide superlatives.
 *
 * Every record here is one that survives being compared across circuits. A
 * lap time does not: the quickest lap in the data will always be whichever
 * circuit is shortest, so "fastest lap ever" would be a fact about the
 * calendar rather than about driving. What travels is a margin, a gap, a
 * count, a speed, or a number of places — quantities whose meaning does not
 * depend on which track produced them. Circuit-specific bests already live on
 * each circuit page, where they belong.
 *
 * Ties are kept rather than broken arbitrarily; every holder is listed.
 */

const TOP = 3;

function best<T>(
  items: T[],
  value: (item: T) => number | null,
  ascending = false,
): T[] {
  const scored = items
    .map((item) => ({ item, v: value(item) }))
    .filter((s): s is { item: T; v: number } => s.v !== null && Number.isFinite(s.v));
  if (scored.length === 0) return [];
  scored.sort((a, b) => (ascending ? a.v - b.v : b.v - a.v));
  return scored.slice(0, TOP).map((s) => s.item);
}

type Candidate = RecordHolder;

function from(race: RaceData, who: string, value: number, display: string, detail?: string): Candidate {
  return {
    who, value, display, detail,
    season: race.season, round: race.round,
    raceName: race.raceName, circuitId: race.circuitId,
  };
}

export function buildRecords(races: RaceData[]): RecordGroup[] {
  const margins: Candidate[] = [];
  const poleMargins: Candidate[] = [];
  const fieldSpread: Candidate[] = [];
  const speedTraps: Candidate[] = [];
  const pitStops: Candidate[] = [];
  const raceGains: Candidate[] = [];
  const lapOneGains: Candidate[] = [];
  const attrition: Candidate[] = [];
  const stints: Candidate[] = [];
  const stopCounts: Candidate[] = [];
  const pointsHauls: Candidate[] = [];

  for (const race of races) {
    // --- Winning margin. Only valid when the runner-up was on the lead lap.
    const winner = race.results.find((r) => r.position === 1);
    const second = race.results.find((r) => r.position === 2);
    if (winner && second?.gapSeconds != null && second.gapSeconds > 0) {
      margins.push(from(race, winner.driver, second.gapSeconds, `${second.gapSeconds.toFixed(3)}s`,
        `from ${second.driver}`));
    }

    // --- Qualifying. Pole margin, and how tightly the top ten were covered.
    const timed = race.qualifying
      .map((q) => ({ driver: q.driver, best: bestQualifyingSeconds(q)?.seconds ?? null }))
      .filter((q): q is { driver: string; best: number } => q.best !== null)
      .sort((a, b) => a.best - b.best);

    if (timed.length >= 2) {
      const gap = timed[1].best - timed[0].best;
      poleMargins.push(from(race, timed[0].driver, gap, `${gap.toFixed(3)}s`,
        `over ${timed[1].driver}`));
    }
    if (timed.length >= 10) {
      const spread = timed[9].best - timed[0].best;
      fieldSpread.push(from(race, timed[0].driver, spread, `${spread.toFixed(3)}s`,
        "covering the top ten"));
    }

    // --- Speed trap and pit lane.
    for (const s of race.sectors) {
      if (s.speedTrapKph !== null) {
        speedTraps.push(from(race, s.driver, s.speedTrapKph, `${Math.round(s.speedTrapKph)} kph`));
      }
    }
    for (const p of race.pitStops) {
      if (p.pitLaneSeconds !== null) {
        pitStops.push(from(race, p.driver, p.pitLaneSeconds, `${p.pitLaneSeconds.toFixed(3)}s`,
          `lap ${p.lap}`));
      }
    }

    // --- Places gained, over the race and over lap one.
    for (const r of race.results) {
      if (r.grid !== null && r.grid > 0 && r.position !== null) {
        const gained = r.grid - r.position;
        raceGains.push(from(race, r.driver, gained, gained > 0 ? `+${gained}` : String(gained),
          `P${r.grid} to P${r.position}`));
      }
      const scored = racePoints(r);
      if (scored > 0) {
        pointsHauls.push(from(race, r.driver, scored, `${scored} pts`,
          r.position ? `P${r.position}` : undefined));
      }
    }
    for (const s of startPerformance(race)) {
      if (s.gained !== null) {
        lapOneGains.push(from(race, s.driver, s.gained, s.gained > 0 ? `+${s.gained}` : String(s.gained),
          `P${s.grid} to P${s.lap1}`));
      }
    }

    // --- Attrition.
    const classified = race.results.filter((r) => r.position !== null).length;
    const retired = race.results.length - classified;
    if (race.results.length > 0) {
      attrition.push(from(race, `${retired}`, retired, `${retired} retired`,
        `${classified} of ${race.results.length} classified`));
    }

    // --- Stints and stop counts.
    for (const s of race.stints) {
      stints.push(from(race, s.driver, s.laps, `${s.laps} laps`, s.compound.toLowerCase()));
    }
    const stopsBy = new Map<string, number>();
    for (const p of race.pitStops) stopsBy.set(p.driver, (stopsBy.get(p.driver) ?? 0) + 1);
    for (const [driver, count] of stopsBy) {
      stopCounts.push(from(race, driver, count, `${count} stops`));
    }
  }

  return [
    {
      title: "The finish",
      note: "Margins are only counted where the runner-up finished on the lead lap; a win taken behind the safety car reports no gap at all.",
      entries: [
        { label: "Largest winning margin", holders: best(margins, (m) => m.value) },
        { label: "Closest finish", holders: best(margins, (m) => m.value, true), ascending: true },
        { label: "Biggest points haul", holders: best(pointsHauls, (p) => p.value) },
      ],
    },
    {
      title: "Qualifying",
      note: "Gaps rather than times, so a session at a short circuit is comparable with one at a long circuit. The field spread is pole to tenth.",
      entries: [
        { label: "Biggest pole margin", holders: best(poleMargins, (p) => p.value) },
        { label: "Closest pole", holders: best(poleMargins, (p) => p.value, true), ascending: true },
        { label: "Tightest top ten", holders: best(fieldSpread, (f) => f.value, true), ascending: true },
        { label: "Most spread-out top ten", holders: best(fieldSpread, (f) => f.value) },
      ],
    },
    {
      title: "Overtaking and starts",
      note: "Places gained from the grid, and across the opening lap alone. Pit lane starts have no grid slot and are excluded.",
      entries: [
        { label: "Most places gained in a race", holders: best(raceGains, (r) => r.value) },
        { label: "Most places lost in a race", holders: best(raceGains, (r) => r.value, true), ascending: true },
        { label: "Best opening lap", holders: best(lapOneGains, (l) => l.value) },
        { label: "Worst opening lap", holders: best(lapOneGains, (l) => l.value, true), ascending: true },
      ],
    },
    {
      title: "The car",
      note: "Speed trap is the highest single reading recorded. Pit lane time is the whole lane, not the stationary time quoted on television.",
      entries: [
        { label: "Highest speed trap", holders: best(speedTraps, (s) => s.value) },
        { label: "Quickest pit lane", holders: best(pitStops, (p) => p.value, true), ascending: true },
        { label: "Longest stint", holders: best(stints, (s) => s.value) },
        { label: "Most stops in one race", holders: best(stopCounts, (s) => s.value) },
      ],
    },
    {
      title: "Attrition",
      note: "Races that took the biggest toll. The holder here is the count, not a driver.",
      entries: [
        { label: "Most retirements", holders: best(attrition, (a) => a.value) },
      ],
    },
  ];
}
