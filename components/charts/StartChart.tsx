"use client";

import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";
import type { StartRow } from "@/lib/analysis/start";

/**
 * Grid slot against position at the end of lap one.
 *
 * A dumbbell rather than a bar: the value is a move between two positions, and
 * a bar would encode only the size of the move while throwing away where it
 * started. Whether a driver went from fifteenth to ninth or from fourth to
 * second matters, and both are "gained six" and "gained two" on a bar chart.
 *
 * The axis is inverted so first sits at the top, and gains and losses are the
 * two ends of a diverging pair rather than one accent — direction is the whole
 * point of the chart.
 */
export default function StartChart({ rows }: { rows: StartRow[] }) {
  const usable = rows.filter((r) => r.gained !== null && r.grid !== null && r.lap1 !== null);
  const excluded = rows.filter((r) => r.gained === null);
  if (usable.length === 0) return null;

  const worst = Math.max(...usable.flatMap((r) => [r.grid!, r.lap1!]));

  // The SVG is authored in a coordinate space close to its rendered size and
  // capped there. A small viewBox stretched to full width scales the text with
  // it, which turned 9px labels into 60px headlines.
  const VIEW = 620;
  const rowHeight = 19;
  const height = usable.length * rowHeight + 30;
  const axisFrom = 62;
  const axisTo = 430;

  const x = (position: number) =>
    axisFrom + ((position - 1) / Math.max(1, worst - 1)) * (axisTo - axisFrom);

  const gained = usable.filter((r) => r.gained! > 0).length;
  const lost = usable.filter((r) => r.gained! < 0).length;

  return (
    <ChartFrame
      label="THE START"
      title="Grid to the end of lap one"
      note={
        <>
          {gained} driver{gained === 1 ? "" : "s"} gained on the opening lap, {lost} lost.
          The line runs from the grid slot to the position held at the end of lap one, so
          the chart keeps where a move started as well as how big it was.
          {excluded.length > 0 && (
            <>
              {" "}
              {excluded.map((r) => r.driver).join(", ")}{" "}
              {excluded.length === 1 ? "is" : "are"} shown without a figure — a pit lane
              start has no grid slot, and a car that did not complete lap one lost every
              place at once, which says nothing about its start.
            </>
          )}
        </>
      }
      legend={
        <ul className="flex flex-wrap gap-x-3 gap-y-1" style={{ listStyle: "none" }}>
          {[
            { label: "Gained", colour: "var(--series-1)" },
            { label: "Lost", colour: "var(--series-2)" },
          ].map((k) => (
            <li key={k.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 12, height: 3, background: k.colour, display: "inline-block" }} />
              <span className="label" style={{ color: "var(--ink)" }}>{k.label}</span>
            </li>
          ))}
        </ul>
      }
      table={
        <DataTable
          caption="Grid position and position at the end of lap one"
          columns={["Driver", "Team", "Grid", "Lap 1", "Gained"]}
          rows={rows.map((r) => [
            r.driver, r.team,
            r.pitLaneStart ? "Pit lane" : r.grid ?? "—",
            r.lap1 ?? "—",
            r.gained === null ? "—" : r.gained > 0 ? `+${r.gained}` : r.gained,
          ])}
        />
      }
    >
      <div>
        <svg
          viewBox={`0 0 ${VIEW} ${height}`}
          style={{ width: "100%", maxWidth: VIEW, display: "block" }}
          role="img"
          aria-label="Grid position against position at the end of lap one, for each driver"
        >
          {[1, Math.round(worst / 2), worst].map((p) => (
            <g key={p}>
              <line x1={x(p)} y1={18} x2={x(p)} y2={height - 8} stroke="var(--border-faint)" strokeWidth={0.5} />
              <text x={x(p)} y={12} textAnchor="middle" style={{ fontSize: 9, fill: "var(--ink-faint)" }}>
                P{p}
              </text>
            </g>
          ))}

          {usable.map((r, i) => {
            const y = 30 + i * rowHeight;
            const from = x(r.grid!);
            const to = x(r.lap1!);
            const colour =
              r.gained! > 0 ? "var(--series-1)" : r.gained! < 0 ? "var(--series-2)" : "var(--ink-faint)";
            return (
              <g key={r.driver}>
                <text x={0} y={y + 3.5} className="num" style={{ fontSize: 11, fill: "var(--ink)", fontWeight: 650 }}>
                  {r.driver}
                </text>
                <rect x={44} y={y - 5} width={3} height={11} fill={r.teamColor ?? FALLBACK_TEAM_COLOR} />

                <line x1={from} y1={y} x2={to} y2={y} stroke={colour} strokeWidth={2.5} strokeLinecap="round" />
                {/* Hollow marker for the grid slot, solid for where the lap
                    ended, so the direction reads without relying on colour. */}
                <circle cx={from} cy={y} r={3.2} fill="var(--surface)" stroke={colour} strokeWidth={1.4} />
                <circle cx={to} cy={y} r={3.6} fill={colour} />

                <text x={axisTo + 22} y={y + 3.5} className="num"
                      style={{ fontSize: 11, fontWeight: 650,
                               fill: r.gained! === 0 ? "var(--ink-faint)" : "var(--ink)" }}>
                  {r.gained! > 0 ? `+${r.gained}` : r.gained}
                </text>
                <text x={axisTo + 56} y={y + 3.5} className="num"
                      style={{ fontSize: 10, fill: "var(--ink-faint)" }}>
                  P{r.grid}→P{r.lap1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartFrame>
  );
}
