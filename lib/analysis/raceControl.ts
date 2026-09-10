import type { RaceControlMessage } from "@/types/data";

export type PeriodKind = "SAFETY_CAR" | "VSC" | "RED_FLAG";

export interface ControlPeriod {
  kind: PeriodKind;
  startLap: number;
  /**
   * Inclusive last lap, or null when race control never sent an end message.
   *
   * That happens. Assuming such a period ran to the flag once drew a fifty-lap
   * safety car across a race that plainly did not have one, so an unknown end
   * stays unknown and the chart marks the deployment as a point.
   */
  endLap: number | null;
}

export interface ControlIncident {
  lap: number;
  flag: string;
  scope: string | null;
  message: string;
}

export interface RaceControlSummary {
  periods: ControlPeriod[];
  incidents: ControlIncident[];
  notable: RaceControlMessage[];
  blueFlagsHidden: number;
}

const LABELS: Record<PeriodKind, string> = {
  SAFETY_CAR: "Safety car",
  VSC: "Virtual safety car",
  RED_FLAG: "Red flag",
};

export const periodLabel = (k: PeriodKind) => LABELS[k];

/**
 * Periods and incidents from race control.
 *
 * Most of race control is per-driver blue flags telling one car to let the
 * leader past — the majority of all messages, and they say nothing about the
 * race. They are dropped, and the count is reported rather than quietly
 * swallowed.
 */
export function summariseRaceControl(messages: RaceControlMessage[]): RaceControlSummary {
  const periods: ControlPeriod[] = [];
  const incidents: ControlIncident[] = [];
  let blueFlagsHidden = 0;
  const open = new Map<PeriodKind, number>();

  const start = (k: PeriodKind, lap: number) => {
    if (!open.has(k)) open.set(k, lap);
  };
  const end = (k: PeriodKind, lap: number) => {
    const from = open.get(k);
    if (from === undefined) return;
    periods.push({ kind: k, startLap: from, endLap: Math.max(lap, from) });
    open.delete(k);
  };

  for (const m of messages) {
    const text = m.message.toUpperCase();
    const lap = m.lap ?? 0;

    if (m.flag === "BLUE") {
      blueFlagsHidden++;
      continue;
    }
    if (m.category === "SafetyCar" || text.includes("SAFETY CAR") || text.includes("VSC")) {
      const kind: PeriodKind = text.includes("VIRTUAL") || text.includes("VSC") ? "VSC" : "SAFETY_CAR";
      if (text.includes("DEPLOYED")) start(kind, lap);
      // "IN THIS LAP" is the call that the car comes in at the end of this lap.
      else if (text.includes("ENDING") || text.includes("IN THIS LAP")) end(kind, lap);
      continue;
    }
    if (m.flag === "RED") {
      if (text.includes("CLEAR") || text.includes("GREEN")) end("RED_FLAG", lap);
      else start("RED_FLAG", lap);
      continue;
    }
    if (m.flag === "YELLOW" || m.flag === "DOUBLE YELLOW") {
      incidents.push({ lap, flag: m.flag, scope: m.scope, message: m.message });
    }
  }

  for (const [kind, from] of open) periods.push({ kind, startLap: from, endLap: null });
  periods.sort((a, b) => a.startLap - b.startLap);
  incidents.sort((a, b) => a.lap - b.lap);

  return { periods, incidents, notable: messages.filter((m) => m.flag !== "BLUE"), blueFlagsHidden };
}
