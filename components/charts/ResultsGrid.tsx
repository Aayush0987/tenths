import Link from "next/link";

import SectionHeading from "@/components/ui/SectionHeading";
import type { Standings } from "@/lib/analysis/championship";
import type { RaceData } from "@/types/data";

/**
 * Every driver against every round.
 *
 * Deliberately not a heatmap on a continuous ramp. Finishing position is not a
 * magnitude the eye should read by shade — the distances that matter are
 * categorical (a win, a podium, points, no points, out), and they are not
 * evenly spaced: P1 to P2 costs seven points, P11 to P12 costs nothing. So the
 * cells are banded to those categories and the number is printed in every one,
 * which also means the grid is readable without colour at all.
 *
 * Server-rendered: it is a table of numbers and needs no JavaScript.
 */

function band(position: number | null): { background: string; color: string; weight: number } {
  if (position === null) {
    return { background: "transparent", color: "var(--ink-faint)", weight: 400 };
  }
  if (position === 1) return { background: "var(--accent)", color: "var(--on-accent)", weight: 700 };
  if (position <= 3) return { background: "var(--accent-wash-strong)", color: "var(--ink)", weight: 650 };
  if (position <= 10) return { background: "var(--accent-wash)", color: "var(--ink)", weight: 500 };
  return { background: "transparent", color: "var(--ink-muted)", weight: 400 };
}

export default function ResultsGrid({
  standings,
  races,
  season,
}: {
  standings: Standings;
  races: RaceData[];
  season: number;
}) {
  const ordered = [...races].sort((a, b) => a.round - b.round);

  // driver -> round -> result
  const lookup = new Map<string, Map<number, { position: number | null; classified: string | null }>>();
  for (const race of ordered) {
    for (const r of race.results) {
      const row = lookup.get(r.driver) ?? new Map();
      row.set(race.round, { position: r.position, classified: r.classified });
      lookup.set(r.driver, row);
    }
  }

  return (
    <section
      className="mb-6"
      style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}
    >
      <div className="px-3 pt-3">
        <SectionHeading
          label="RESULTS"
          title={`${season} finishing positions`}
          note={
            <>
              Banded by what the position was worth — win, podium, points, outside the
              points — rather than shaded on a continuous scale, because the gaps
              between positions are not evenly spaced. Every cell prints its number, so
              the grid reads without colour. A blank cell is a round the driver did not
              contest; <span className="num">R</span> is a retirement,{" "}
              <span className="num">D</span> a disqualification.
            </>
          }
        />
        <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1" style={{ listStyle: "none" }}>
          {[
            { label: "Win", ...band(1) },
            { label: "Podium", ...band(2) },
            { label: "Points", ...band(5) },
            { label: "No points", ...band(15) },
          ].map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                style={{
                  width: 13, height: 13, background: s.background,
                  border: s.background === "transparent" ? "1px solid var(--border)" : "none",
                  display: "inline-block",
                }}
              />
              <span className="label" style={{ color: "var(--ink-muted)" }}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-3 pb-3" style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "2px", fontSize: 11 }}>
          <caption className="sr-only">
            {season} finishing position for every driver in every round
          </caption>
          <thead>
            <tr>
              <th scope="col" className="label" style={{ textAlign: "left", padding: "2px 6px" }}>
                Driver
              </th>
              {ordered.map((race) => (
                <th
                  key={race.round}
                  scope="col"
                  className="num"
                  style={{ padding: "2px 0", fontWeight: 500, color: "var(--ink-faint)", width: 22 }}
                  title={race.raceName}
                >
                  <Link href={`/${season}/${race.round}`} style={{ color: "inherit" }}>
                    {race.round}
                  </Link>
                </th>
              ))}
              <th scope="col" className="label" style={{ padding: "2px 6px", textAlign: "right" }}>
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.drivers.map((d) => (
              <tr key={d.code}>
                <th scope="row" style={{ textAlign: "left", padding: "2px 6px", whiteSpace: "nowrap" }}>
                  <Link href={`/driver/${d.code}`} className="flex items-center gap-1.5" style={{ color: "inherit" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 3, height: 11,
                        background: d.teamColor ?? "var(--ink-faint)",
                        display: "inline-block",
                      }}
                    />
                    <span className="num" style={{ fontWeight: 600 }}>{d.code}</span>
                  </Link>
                </th>
                {ordered.map((race) => {
                  const cell = lookup.get(d.code)?.get(race.round);
                  const style = band(cell?.position ?? null);
                  const text = cell
                    ? (cell.position ?? (cell.classified === "D" ? "D" : "R"))
                    : "";
                  return (
                    <td
                      key={race.round}
                      className="num"
                      style={{
                        padding: "2px 0", textAlign: "center", width: 22,
                        background: style.background, color: style.color,
                        fontWeight: style.weight,
                      }}
                      title={cell ? `${race.raceName}: ${text}` : `${race.raceName}: did not contest`}
                    >
                      {text}
                    </td>
                  );
                })}
                <td className="num" style={{ padding: "2px 6px", textAlign: "right", fontWeight: 600 }}>
                  {d.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
