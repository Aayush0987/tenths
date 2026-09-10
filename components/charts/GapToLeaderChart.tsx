"use client";

import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Driver, Lap } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";
import { computeGapToLeader, type GapRow } from "@/lib/analysis/gapToLeader";

const CLAMP = 90;
/** Two end labels closer than this overlap, so the later one is dropped. */
const LABEL_MIN_GAP = 8;

interface LabelProps {
  x?: string | number;
  y?: string | number;
  index?: number;
}

/**
 * The driver code where a line ends.
 *
 * Team colour is an affordance and never the encoding, so a chart drawn in
 * team colours has to name its lines somewhere other than a tooltip. Lines
 * stop at different laps — retirements, and anyone past the clamp — so the
 * ends are scattered and most fit. Recharts wants an element back, so a
 * skipped label is an empty group.
 */
function makeEndLabel(driver: string, lastIndex: number, claimed: number[]) {
  function EndLabel({ x = 0, y = 0, index = -1 }: LabelProps) {
    if (index !== lastIndex) return <g />;
    const top = Number(y);
    if (claimed.some((t) => Math.abs(t - top) < LABEL_MIN_GAP)) return <g />;
    claimed.push(top);
    return (
      <text x={Number(x) + 4} y={top} dominantBaseline="central" fontSize={8} fontWeight={700} fill={CHART_INK.label}>
        {driver}
      </text>
    );
  }
  EndLabel.displayName = `EndLabel-${driver}`;
  return EndLabel;
}

function GapTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const order = payload
    .filter((p) => typeof p.value === "number")
    .map((p) => ({ driver: String(p.dataKey), gap: p.value as number }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 8);
  return (
    <div style={{
      background: "var(--surface-raised)", border: "1px solid var(--border-strong)",
      boxShadow: "var(--shadow-md)", padding: "7px 9px", fontSize: "var(--text-small)",
    }}>
      <p style={{ fontWeight: 700, marginBottom: 3 }}>Lap {label}</p>
      {order.map(({ driver, gap }) => (
        <p key={driver} className="num" style={{ color: "var(--ink-muted)", lineHeight: 1.5 }}>
          <span style={{ color: "var(--ink)", fontWeight: 600, display: "inline-block", width: 32 }}>{driver}</span>
          {gap === 0 ? "leader" : `+${gap.toFixed(1)}`}
        </p>
      ))}
    </div>
  );
}

export default function GapToLeaderChart({
  laps, drivers, totalLaps,
}: { laps: Lap[]; drivers: Driver[]; totalLaps: number }) {
  const { rows, drivers: plotted, maxGap, clamped } = computeGapToLeader(laps, CLAMP);
  if (rows.length < 4 || plotted.length < 2) return null;

  const colorOf = new Map(drivers.map((d) => [d.code, d.teamColor ?? FALLBACK_TEAM_COLOR]));
  const lastIndexOf = new Map<string, number>();
  rows.forEach((row, i) => {
    for (const d of plotted) if (typeof row[d] === "number") lastIndexOf.set(d, i);
  });
  const claimed: number[] = [];

  const table = (
    <DataTable
      caption="Gap to the leader in seconds, every fifth lap"
      columns={["Lap", ...plotted.slice(0, 8)]}
      rows={rows.filter((r) => r.lap % 5 === 0 || r.lap === 1).map((row) => [
        row.lap,
        ...plotted.slice(0, 8).map((d) => {
          const v = (row as GapRow)[d];
          return typeof v === "number" ? (v === 0 ? "lead" : `+${v.toFixed(1)}`) : null;
        }),
      ])}
    />
  );

  return (
    <ChartFrame
      label="THE RACE"
      title="Gap to the leader"
      note={`Zero is whoever led on the road at that moment, not the eventual winner. A step of about twenty seconds is a pit stop; the whole field falling toward the line at once is a safety car.${clamped > 0 ? " Gaps past 90s are left off — once a driver is lapped the axis would stretch to fit them and flatten the fight at the front." : ""}`}
      table={table}
    >
      <div style={{ minWidth: 560, height: 330 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 28, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            <XAxis
              dataKey="lap" type="number" domain={[1, totalLaps]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
            />
            <YAxis
              type="number" reversed domain={[0, Math.ceil(maxGap / 10) * 10]} width={44}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => (v === 0 ? "LEAD" : `+${v}s`)}
            />
            <Tooltip content={<GapTooltip />} cursor={{ stroke: CHART_INK.grid, strokeWidth: 1 }} />
            {plotted.map((driver) => (
              <Line
                key={driver} type="linear" dataKey={driver}
                stroke={colorOf.get(driver) ?? FALLBACK_TEAM_COLOR}
                strokeWidth={1.25} dot={false} activeDot={{ r: 2.5, strokeWidth: 0 }}
                isAnimationActive={false} connectNulls={false}
              >
                <LabelList dataKey={driver} content={makeEndLabel(driver, lastIndexOf.get(driver) ?? -1, claimed)} />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
