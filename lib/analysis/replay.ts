import type { Compound, RaceData } from "@/types/data";

/* ---------------------------------------------------------------------------
 * Wire format
 *
 * The replay is the one view that has to ship its whole dataset to the
 * browser: scrubbing has to be instant, so every lap has to be there before
 * the first drag. For a sixty-lap race that is around twelve hundred entries,
 * and as objects most of those bytes are the property names repeated twelve
 * hundred times — measured at 133 KB, which Next then serialises twice, once
 * into the HTML and again into the flight payload.
 *
 * So it goes over as tuples against a driver and compound table, the same
 * trade the data files on disk already make, and is expanded once on arrival.
 * Field order is meaning here, so the decoder is written directly beneath the
 * encoder and they are read together.
 * ------------------------------------------------------------------------- */

/** [driver, position, gap ×10, compound, pitting, fraction ×1000] */
type WireEntry = [number, number, number | null, number | null, 0 | 1, number];

/** [lap, leader, entries, newly retired] */
type WireLap = [number, number, WireEntry[], number[]];

export interface ReplayWire {
  v: 1;
  totalLaps: number;
  /** Median leader lap, seconds ×1000. */
  reference: number;
  drivers: string[];
  compounds: string[];
  laps: WireLap[];
}

export interface ReplayEntry {
  driver: string;
  position: number;
  /** Seconds behind the leader at this lap. Zero for the leader. */
  gapSeconds: number | null;
  compound: Compound | null;
  /** Pitted at the end of this lap. */
  pitting: boolean;
  /**
   * Where the car is around the lap, 0 at the start line running to 1.
   * Reconstructed from the gap, not measured — see buildReplay.
   */
  trackFraction: number;
}

export interface ReplayLap {
  lap: number;
  leader: string;
  entries: ReplayEntry[];
  /** Everyone who had retired by this lap, most recent first. */
  out: string[];
}

export interface Replay {
  laps: ReplayLap[];
  totalLaps: number;
  referenceLapSeconds: number;
}

/**
 * The race, lap by lap, as a scrubbable sequence.
 *
 * Running order and gaps are measured, not modelled: every lap carries the
 * driver's classified position and the session clock at which they crossed the
 * line, so the order at lap N is exactly what it was and the gap is the
 * difference between two recorded times.
 *
 * Where a car sits *around the circuit* is the one reconstructed quantity. The
 * data records a car once a lap, at the line, so between two lap lines there
 * is nothing to read; a car N seconds behind the leader is drawn N seconds
 * back along the track, which assumes it is lapping at the reference pace. It
 * is right at the line every lap and an approximation in between, and the UI
 * says so rather than implying the dots are telemetry.
 */
export function buildReplay(race: RaceData): ReplayWire {
  const byLap = new Map<number, Map<string, (typeof race.laps)[number]>>();
  for (const lap of race.laps) {
    const row = byLap.get(lap.lap) ?? new Map();
    row.set(lap.driver, lap);
    byLap.set(lap.lap, row);
  }

  const pitLaps = new Set(race.pitStops.map((p) => `${p.driver}:${p.lap}`));

  const lastLap = new Map<string, number>();
  for (const lap of race.laps) {
    lastLap.set(lap.driver, Math.max(lastLap.get(lap.driver) ?? 0, lap.lap));
  }

  // Median leader lap, as the yardstick for turning a gap into a distance.
  const leaderTimes: number[] = [];
  for (const [, row] of byLap) {
    for (const lap of row.values()) {
      if (lap.position === 1 && lap.seconds !== null) leaderTimes.push(lap.seconds);
    }
  }
  leaderTimes.sort((a, b) => a - b);
  const reference = leaderTimes.length
    ? leaderTimes[Math.floor(leaderTimes.length / 2)]
    : 90;

  const drivers: string[] = [];
  const driverIndex = new Map<string, number>();
  const idOf = (code: string) => {
    let i = driverIndex.get(code);
    if (i === undefined) {
      i = drivers.push(code) - 1;
      driverIndex.set(code, i);
    }
    return i;
  };

  const compounds: string[] = [];
  const compoundIndex = new Map<string, number>();
  const compoundOf = (c: string | null) => {
    if (!c) return null;
    let i = compoundIndex.get(c);
    if (i === undefined) {
      i = compounds.push(c) - 1;
      compoundIndex.set(c, i);
    }
    return i;
  };

  const laps: WireLap[] = [];
  for (let n = 1; n <= race.totalLaps; n++) {
    const row = byLap.get(n);
    if (!row) continue;

    const leaderLap = [...row.values()].find((l) => l.position === 1);
    const leaderClock = leaderLap?.clock ?? null;

    const entries: WireEntry[] = [];
    for (const lap of row.values()) {
      if (lap.position === null) continue;

      const gap =
        leaderClock !== null && lap.clock !== null ? lap.clock - leaderClock : null;

      // Modulo the reference lap, so a lapped car is drawn in its real place
      // on the circuit rather than pushed off the end of it.
      const behind = gap === null ? 0 : Math.max(0, gap);
      const fraction = ((behind % reference) / reference) || 0;

      entries.push([
        idOf(lap.driver),
        lap.position,
        // Tenths: the leaderboard shows one decimal, so the rest is noise on
        // the wire.
        gap === null ? null : Math.round(gap * 10),
        compoundOf(lap.compound),
        pitLaps.has(`${lap.driver}:${n}`) ? 1 : 0,
        // Measured backwards from the line: the leader sits at 0, everyone
        // else is that far round behind. Thousandths is finer than a pixel.
        Math.round(((1 - fraction) % 1) * 1000),
      ]);
    }
    entries.sort((a, b) => a[1] - b[1]);

    const out = [...lastLap.entries()]
      .filter(([, last]) => last < n)
      .sort((a, b) => b[1] - a[1])
      .map(([driver]) => idOf(driver));

    laps.push([n, idOf(leaderLap?.driver ?? drivers[entries[0]?.[0]] ?? ""), entries, out]);
  }

  return {
    v: 1,
    totalLaps: race.totalLaps,
    reference: Math.round(reference * 1000),
    drivers,
    compounds,
    laps,
  };
}

/** Expand the wire format. Mirrors buildReplay field for field. */
export function decodeReplay(wire: ReplayWire): Replay {
  return {
    totalLaps: wire.totalLaps,
    referenceLapSeconds: wire.reference / 1000,
    laps: wire.laps.map(([lap, leader, entries, out]) => ({
      lap,
      leader: wire.drivers[leader] ?? "",
      entries: entries.map(([driver, position, gap, compound, pitting, fraction]) => ({
        driver: wire.drivers[driver] ?? "",
        position,
        gapSeconds: gap === null ? null : gap / 10,
        compound: compound === null ? null : (wire.compounds[compound] as Compound),
        pitting: pitting === 1,
        trackFraction: fraction / 1000,
      })),
      out: out.map((i) => wire.drivers[i] ?? ""),
    })),
  };
}
