"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Lap, Stint } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { makeDotShape } from "@/components/charts/dotPlotShape";
import { CHART_ACCENT, CHART_INK } from "@/lib/charts/palette";
import { computeConsistency, type ConsistencyRow } from "@/lib/analysis/consistency";
import { formatLap } from "@/lib/format";

export default function ConsistencyChart({ laps, stints }: { laps: Lap[]; stints: Stint[] }) {
  const rows = computeConsistency(laps, stints);
  if (rows.length < 3) return null;

  const floor = Math.floor(rows[0].deviation * 20) / 20 - 0.05;
  const ceiling = Math.ceil(rows[rows.length - 1].deviation * 20) / 20 + 0.05;

  return (
    <ChartFrame
      label="RACE CRAFT"
      title="Who was steadiest"
      note="The spread of each driver's clean laps — further left means lap after lap at the same pace. Not a measure of speed: a driver can be quick and erratic, or a tenth off and never vary. Out laps, in laps and anything past 107% of the driver's own median are excluded."
      table={
        <DataTable
          caption="Lap time spread by driver, steadiest first"
          columns={["Driver", "Spread", "Median lap", "Clean laps"]}
          rows={rows.map((r) => [r.driver, `±${r.deviation.toFixed(3)}`, formatLap(r.medianSeconds), r.laps])}
        />
      }
    >
      <div style={{ minWidth: 420, height: rows.length * 18 + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis
              type="number" domain={[floor, ceiling]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
              tickFormatter={(v: number) => `±${v.toFixed(1)}s`}
            />
            <YAxis
              type="category" dataKey="driver" width={34} interval={0}
              tick={{ fontSize: 9, fill: CHART_INK.label, fontWeight: 700 }}
              tickLine={false} axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-hover)" }}
              contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)", fontSize: 11 }}
              formatter={(v) => [`±${Number(v).toFixed(3)}s`, "Spread"]}
            />
            <Bar
              dataKey="deviation" isAnimationActive={false}
              shape={makeDotShape<ConsistencyRow>({
                floor, ceiling, color: CHART_ACCENT,
                value: (r) => r.deviation,
                label: (r) => `±${r.deviation.toFixed(3)}`,
              })}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
