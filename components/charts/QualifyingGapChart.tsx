"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { QualifyingResult } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK } from "@/lib/charts/palette";
import { parseLapTime } from "@/lib/format";

interface Row { driver: string; gap: number; reached: "Q1" | "Q2" | "Q3"; best: string; [k: string]: unknown }

interface ShapeProps { x?: number; y?: number; width?: number; height?: number; payload?: Row }

/** Pole is a zero-length bar, so it gets a marker rather than nothing. */
function GapBar({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  if (!payload) return null;
  const isPole = payload.gap === 0;
  return (
    <g>
      {isPole
        ? <rect x={x} y={y} width={2.5} height={height} fill="var(--accent)" />
        : <rect x={x} y={y} width={width} height={height} fill="var(--accent)" />}
      <text x={x + (isPole ? 7 : width + 6)} y={y + height / 2} dominantBaseline="central"
            fontSize={9} fill={CHART_INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
        {isPole ? "POLE" : `+${payload.gap.toFixed(3)}`}
        <tspan fill={CHART_INK.axis} dx={6}>{payload.reached}</tspan>
      </text>
    </g>
  );
}

export default function QualifyingGapChart({ qualifying }: { qualifying: QualifyingResult[] }) {
  const rows: Row[] = [];
  for (const r of qualifying) {
    // A driver's representative time is the last one they set.
    const found = ([["Q3", r.q3], ["Q2", r.q2], ["Q1", r.q1]] as const)
      .find(([, t]) => parseLapTime(t) !== null);
    if (!found) continue;
    const [reached, time] = found;
    const secs = parseLapTime(time);
    if (secs === null) continue;
    rows.push({ driver: r.driver, gap: secs, reached, best: time ?? "" });
  }
  if (rows.length < 2) return null;

  rows.sort((a, b) => a.gap - b.gap);
  const pole = rows[0].gap;
  for (const r of rows) r.gap = Number((r.gap - pole).toFixed(3));
  const slowest = rows[rows.length - 1].gap;

  return (
    <ChartFrame
      label="QUALIFYING"
      title="Gap to pole"
      note="Each driver's best lap against pole. Q1, Q2 or Q3 marks the last segment they set a time in, so a small gap on a Q1 label means a fast lap that still went out early."
      table={
        <DataTable
          caption="Qualifying times and gap to pole"
          columns={["Driver", "Best", "Reached", "Gap"]}
          rows={rows.map((r) => [r.driver, r.best, r.reached, r.gap === 0 ? "pole" : `+${r.gap.toFixed(3)}`])}
        />
      }
    >
      <div style={{ minWidth: 460, height: rows.length * 18 + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis
              type="number" domain={[0, Math.ceil(slowest * 10) / 10]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
              tickFormatter={(v: number) => `+${v.toFixed(1)}s`}
            />
            <YAxis
              type="category" dataKey="driver" width={34} interval={0}
              tick={{ fontSize: 9, fill: CHART_INK.label, fontWeight: 700 }}
              tickLine={false} axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-hover)" }}
              contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)", fontSize: 11 }}
              formatter={(v) => [`+${Number(v).toFixed(3)}s`, "Off pole"]}
            />
            <Bar dataKey="gap" isAnimationActive={false} shape={GapBar} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
