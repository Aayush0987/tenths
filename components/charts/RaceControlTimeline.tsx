import type { RaceControlMessage } from "@/types/data";
import SectionHeading from "@/components/ui/SectionHeading";
import { periodLabel, summariseRaceControl, type PeriodKind } from "@/lib/analysis/raceControl";

/**
 * Race control is a sequence of states over laps, not a set of measurements,
 * so this is a positioned strip rather than a plot: laps map to percentages,
 * no chart library, and it stays a Server Component.
 *
 * Colours are status, not identity. Safety car and virtual safety car are the
 * same caution at different intensities, so they share the reserved warning
 * hue and are told apart by their labels rather than by inventing a second
 * status colour.
 */
const STYLE: Record<PeriodKind, { fill: string; short: string }> = {
  SAFETY_CAR: { fill: "var(--status-caution)", short: "SC" },
  VSC: { fill: "var(--status-caution-soft)", short: "VSC" },
  RED_FLAG: { fill: "var(--status-critical)", short: "RED" },
};

export default function RaceControlTimeline({
  messages, totalLaps,
}: { messages: RaceControlMessage[]; totalLaps: number }) {
  const { periods, incidents, notable, blueFlagsHidden } = summariseRaceControl(messages);
  if (periods.length === 0 && incidents.length === 0) return null;

  const pct = (lap: number) =>
    Math.min(100, Math.max(0, ((lap - 1) / Math.max(1, totalLaps - 1)) * 100));

  return (
    <section className="mb-6" style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
      <div className="px-3 pt-3">
        <SectionHeading
          label="RACE CONTROL"
          title="Flags & interventions"
          note={
            <>
              When the race was neutralised and where the yellows came out.
              {blueFlagsHidden > 0 && ` ${blueFlagsHidden} blue flags are left out — each tells one car to let the leader past, so they say nothing about the race.`}
            </>
          }
        />

        <div className="flex flex-wrap gap-3 mb-2">
          {[...new Set(periods.map((p) => p.kind))].map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 8, height: 8, background: STYLE[k].fill, display: "inline-block" }} />
              <span className="label">{periodLabel(k)}</span>
            </span>
          ))}
          {incidents.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 2, height: 8, background: "var(--ink-muted)", display: "inline-block" }} />
              <span className="label">Yellow flag</span>
            </span>
          )}
        </div>
      </div>

      <div className="px-3 pb-3" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 460 }}>
          <div style={{ position: "relative", height: 22, background: "var(--surface-sunken)", border: "1px solid var(--border-faint)" }}>
            {periods.map((p, i) => {
              const left = pct(p.startLap);
              const s = STYLE[p.kind];
              if (p.endLap === null) {
                // End unrecorded: a marker, so the strip never claims a
                // duration the data did not give.
                return (
                  <div key={i} title={`${periodLabel(p.kind)} deployed lap ${p.startLap} — end not recorded`}
                       style={{ position: "absolute", left: `${left}%`, top: 0, bottom: 0, width: 3, background: s.fill }} />
                );
              }
              const width = Math.max(1.2, pct(p.endLap) - left);
              return (
                <div key={i} title={`${periodLabel(p.kind)}, laps ${p.startLap}–${p.endLap}`}
                     style={{
                       position: "absolute", left: `${left}%`, width: `${width}%`, top: 0, bottom: 0,
                       background: s.fill, display: "flex", alignItems: "center", justifyContent: "center",
                       fontSize: 8, fontWeight: 800, color: "var(--status-caution-ink)", overflow: "hidden",
                     }}>
                  {width > 6 ? s.short : ""}
                </div>
              );
            })}
          </div>

          <div style={{ position: "relative", height: 12, marginTop: 2 }}>
            {incidents.map((inc, i) => (
              <div key={i} title={`Lap ${inc.lap}: ${inc.message}`}
                   style={{
                     position: "absolute", left: `${pct(inc.lap)}%`, top: 0,
                     width: inc.flag === "DOUBLE YELLOW" ? 2 : 1,
                     height: inc.flag === "DOUBLE YELLOW" ? 12 : 8,
                     background: "var(--ink-muted)",
                     opacity: inc.flag === "DOUBLE YELLOW" ? 0.9 : 0.5,
                   }} />
            ))}
          </div>

          <div className="flex justify-between num" style={{ marginTop: 3, fontSize: "var(--text-micro)", color: "var(--ink-faint)" }}>
            <span>LAP 1</span><span>{Math.round(totalLaps / 2)}</span><span>{totalLaps}</span>
          </div>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary className="label" style={{ cursor: "pointer" }}>
            ALL {notable.length} MESSAGES
          </summary>
          <div style={{ maxHeight: 280, overflowY: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-small)" }}>
              <caption className="sr-only">Race control messages, blue flags excluded</caption>
              <thead>
                <tr>
                  {["Lap", "Flag", "Message"].map((c) => (
                    <th key={c} scope="col" className="label" style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notable.map((m, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border-faint)" }}>
                    <td className="num" style={{ padding: "4px 8px", color: "var(--ink)" }}>{m.lap ?? "—"}</td>
                    <td style={{ padding: "4px 8px", color: "var(--ink-muted)" }}>{m.flag ?? m.category}</td>
                    <td style={{ padding: "4px 8px", color: "var(--ink-muted)" }}>{m.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
