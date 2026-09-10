"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ComparePoint } from "@/lib/analysis/lapCompare";
import { CHART_INK, SERIES_COLORS } from "@/lib/charts/palette";

interface Props {
  points: ComparePoint[];
  codeA: string;
  codeB: string;
}

const tooltipStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border-strong)",
  fontSize: 11,
} as const;

/**
 * Speed against distance, and the time delta between the two laps.
 *
 * Two plots on one distance axis rather than one plot with two scales: speed
 * is km/h and delta is seconds, and putting them on a shared y would invent a
 * relationship between them. They are stacked and aligned instead, which is
 * what makes "he gains through here" readable.
 */
export default function LapTraceCharts({ points, codeA, codeB }: Props) {
  if (points.length < 10) return null;
  const maxDelta = Math.max(0.1, ...points.map((p) => Math.abs(p.delta ?? 0)));

  return (
    <>
      <div style={{ minWidth: 520, height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 10, bottom: 0, left: 0 }} syncId="lap">
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            <XAxis dataKey="distance" type="number" domain={[0, "dataMax"]} hide />
            <YAxis
              width={42} tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `${v}`}
              label={{ value: "KM/H", position: "insideTopLeft", fontSize: 8, fill: CHART_INK.axis, offset: 4 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: CHART_INK.grid, strokeWidth: 1 }}
              labelFormatter={(d) => `${Math.round(Number(d))} m`}
              formatter={(v, n) => [`${Number(v).toFixed(0)} km/h`, n === "a" ? codeA : codeB]}
            />
            <Line dataKey="a" stroke={SERIES_COLORS[0]} strokeWidth={1.5} dot={false}
                  activeDot={{ r: 2.5, strokeWidth: 0 }} isAnimationActive={false} connectNulls />
            <Line dataKey="b" stroke={SERIES_COLORS[1]} strokeWidth={1.5} dot={false}
                  activeDot={{ r: 2.5, strokeWidth: 0 }} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ minWidth: 520, height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 10, bottom: 4, left: 0 }} syncId="lap">
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            <XAxis
              dataKey="distance" type="number" domain={[0, "dataMax"]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
              tickFormatter={(v: number) => `${Math.round(v)}m`}
            />
            <YAxis
              width={42} domain={[-maxDelta, maxDelta]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
            />
            {/* Zero is where the laps are level; above it the second driver is behind. */}
            <ReferenceLine y={0} stroke={CHART_INK.grid} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: CHART_INK.grid, strokeWidth: 1 }}
              labelFormatter={(d) => `${Math.round(Number(d))} m`}
              formatter={(v) => {
                const n = Number(v);
                return [`${n > 0 ? "+" : ""}${n.toFixed(3)}s`, n >= 0 ? `${codeB} behind` : `${codeB} ahead`];
              }}
            />
            <Line dataKey="delta" stroke="var(--accent)" strokeWidth={1.75} dot={false}
                  activeDot={{ r: 2.5, strokeWidth: 0 }} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
