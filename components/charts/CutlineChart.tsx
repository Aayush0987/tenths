import Link from "next/link";

import SectionHeading from "@/components/ui/SectionHeading";
import { FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";
import type { CutlineSegment } from "@/lib/analysis/cutline";
import { formatLap } from "@/lib/format";

/**
 * Qualifying as three eliminations, with the line drawn.
 *
 * The interesting number in Q1 is not who was quickest — it is how close the
 * cars either side of fifteenth were, which is often a few hundredths across
 * four or five drivers. So each segment is ranked with the cut drawn through
 * it and the gap to the cut printed, rather than only the gap to pole.
 *
 * Server-rendered: three ordered lists and a rule.
 */
export default function CutlineChart({ segments }: { segments: CutlineSegment[] }) {
  if (segments.length === 0) return null;

  return (
    <section
      className="mb-6"
      style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}
    >
      <div className="px-3 pt-3">
        <SectionHeading
          label="QUALIFYING"
          title="The cutline"
          note={
            <>
              Each segment ranked, with the elimination line drawn where it actually fell —
              the number advancing is read from who appears in the next segment rather than
              assumed to be fifteen and ten, because a session where cars set no time
              produces a shorter list. The figure beside each driver is the gap to the last
              car through; a driver who missed by a few hundredths is the story of Q1, and
              the gap to pole does not show it.
            </>
          }
        />
      </div>

      <div className="grid-3up px-3 pb-3" style={{ gap: "var(--space-3)" }}>
        {segments.map((segment) => {
          const best = segment.drivers[0]?.seconds ?? 0;
          return (
            <div key={segment.segment}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
                <span className="label" style={{ color: "var(--ink)" }}>{segment.label}</span>
                <span className="label" style={{ color: "var(--ink-faint)" }}>
                  {segment.advances === null
                    ? `${segment.drivers.length} for pole`
                    : `${segment.advances} advance`}
                </span>
              </div>

              <ol style={{ listStyle: "none", display: "grid", gap: 1 }}>
                {segment.drivers.map((d, i) => {
                  const isCut = segment.advances !== null && i === segment.advances;
                  return (
                    <li key={d.driver}>
                      {/* The rule sits above the first eliminated driver. */}
                      {isCut && (
                        <div
                          className="flex items-center"
                          style={{ gap: 6, margin: "5px 0 6px" }}
                          aria-hidden="true"
                        >
                          <span style={{ flex: 1, height: 1, background: "var(--status-critical)" }} />
                          <span
                            className="label"
                            style={{ color: "var(--status-critical)", letterSpacing: "0.1em" }}
                          >
                            CUT
                          </span>
                          <span style={{ flex: 1, height: 1, background: "var(--status-critical)" }} />
                        </div>
                      )}

                      <Link
                        href={`/driver/${d.driver}`}
                        className="row-link"
                        style={{
                          gap: "var(--space-2)", padding: "3px 5px",
                          opacity: d.advanced ? 1 : 0.62,
                        }}
                      >
                        <span className="num" style={{ width: 16, color: "var(--ink-faint)", fontSize: "var(--text-small)" }}>
                          {d.rank}
                        </span>
                        <span
                          aria-hidden="true"
                          style={{ width: 3, height: 11, background: d.teamColor ?? FALLBACK_TEAM_COLOR, display: "inline-block" }}
                        />
                        <span className="num" style={{ width: 36, fontWeight: 650 }}>{d.driver}</span>
                        <span className="num" style={{ color: "var(--ink-muted)", fontSize: "var(--text-small)" }}>
                          {d.rank === 1 ? formatLap(d.seconds) : `+${(d.seconds - best).toFixed(3)}`}
                        </span>
                        {d.gapToCut !== null && (
                          <span
                            className="num ml-auto"
                            title="Gap to the last car through"
                            style={{
                              fontSize: "var(--text-small)",
                              color: d.advanced ? "var(--ink-faint)" : "var(--status-critical)",
                            }}
                          >
                            {d.gapToCut > 0 ? `+${d.gapToCut.toFixed(3)}` : d.gapToCut.toFixed(3)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
