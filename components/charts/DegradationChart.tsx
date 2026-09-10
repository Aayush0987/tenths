"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Lap, Stint } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, COMPOUND_LABELS, compoundColor } from "@/lib/charts/palette";
import { computeDegradation } from "@/lib/analysis/degradation";

/** Avoids printing "-0.000s/lap" for a slope that rounds to nothing. */
function formatSlope(slope: number): string {
  const r = Number(slope.toFixed(3));
  if (Object.is(r, -0) || r === 0) return "0.000";
  return `${r > 0 ? "+" : ""}${r.toFixed(3)}`;
}

export default function DegradationChart({ laps, stints }: { laps: Lap[]; stints: Stint[] }) {
  const { points, summaries } = computeDegradation(laps, stints);
  if (points.length < 4 || summaries.length === 0) return null;

  const legend = (
    <div className="flex flex-wrap gap-4">
      {summaries.map((s) => (
        <span key={s.compound} className="flex items-center gap-1.5">
          <span aria-hidden="true" style={{ width: 8, height: 8, background: compoundColor(s.compound), display: "inline-block" }} />
          <span className="label">{COMPOUND_LABELS[s.compound]}</span>
          <span className="num" style={{ fontSize: "var(--text-micro)", color: "var(--ink-faint)" }}>
            {formatSlope(s.slope)}s/lap
          </span>
        </span>
      ))}
    </div>
  );

  const table = (
    <DataTable
      caption="Seconds off the stint best by tyre age"
      columns={["Tyre age", ...summaries.map((s) => COMPOUND_LABELS[s.compound])]}
      rows={points.map((p) => [
        p.age,
        ...summaries.map((s) => {
          const v = p[s.compound];
          return typeof v === "number" ? `+${v.toFixed(2)}` : null;
        }),
      ])}
    />
  );

  return (
    <ChartFrame
      label="TYRE WEAR"
      title="Degradation by compound"
      note="Seconds off each stint's own best lap as the set ages, median across every driver. Measuring each stint against itself removes the fuel effect between stints run at different points in the race; there is still no correction within a stint, so a long run's wear is understated. Dots are the medians, lines the least-squares fit."
      legend={legend}
      table={table}
    >
      <div style={{ minWidth: 480, height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            <XAxis
              dataKey="age" type="number" domain={[1, "dataMax"]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
            />
            <YAxis
              width={40} tick={{ fontSize: 9, fill: CHART_INK.axis }}
              tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `+${v.toFixed(1)}s`}
            />
            <Tooltip
              cursor={{ stroke: CHART_INK.grid, strokeWidth: 1 }}
              contentStyle={{
                background: "var(--surface-raised)", border: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow-md)", fontSize: 11,
              }}
              labelFormatter={(age) => `Tyre age ${age}`}
              formatter={(value, name) => [
                typeof value === "number" ? `+${value.toFixed(2)}s` : String(value ?? "—"),
                COMPOUND_LABELS[String(name) as keyof typeof COMPOUND_LABELS] ?? String(name),
              ]}
              filterNull
            />
            {/* Medians as dots, the fit as the line: joining the medians draws
                one race's scatter, and the trend is the claim being made. */}
            {summaries.map((s) => (
              <Line
                key={`${s.compound}-pts`} dataKey={s.compound} stroke="none"
                dot={{ r: 1.8, fill: compoundColor(s.compound), strokeWidth: 0 }}
                activeDot={{ r: 3.5, strokeWidth: 0 }} isAnimationActive={false}
              />
            ))}
            {summaries.map((s) => (
              <Line
                key={`${s.compound}-fit`} type="linear" dataKey={`${s.compound}_fit`}
                stroke={compoundColor(s.compound)} strokeWidth={1.75}
                dot={false} activeDot={false} isAnimationActive={false} connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
