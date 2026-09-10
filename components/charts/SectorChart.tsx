"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SectorBests } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, SECTOR_COLORS, SECTOR_LABELS } from "@/lib/charts/palette";
import { formatLap } from "@/lib/format";

interface Row {
  driver: string;
  losses: [number, number, number];
  bests: [number, number, number];
  theoretical: number;
  total: number;
  [k: string]: unknown;
}

interface ShapeProps { x?: number; y?: number; width?: number; height?: number; payload?: Row }

/**
 * One sector's share of a driver's deficit.
 *
 * A custom shape rather than <Cell> for the same reason as the tyre chart: a
 * sector best is a zero-length segment, Recharts renders nothing for one, and
 * every later row's colour shifts.
 */
function makeSegment(index: number) {
  function Segment({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
    if (!payload) return null;
    return (
      <g>
        {width > 0 && (
          <rect x={x} y={y} width={width} height={height}
                fill={SECTOR_COLORS[index]} stroke={CHART_INK.surface} strokeWidth={2} />
        )}
        {index === 2 && (
          <text x={x + width + 6} y={y + height / 2} dominantBaseline="central"
                fontSize={9} fill={CHART_INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
            {payload.total === 0 ? "IDEAL" : `+${payload.total.toFixed(3)}`}
          </text>
        )}
      </g>
    );
  }
  Segment.displayName = `SectorSegment${index}`;
  return Segment;
}

export default function SectorChart({ sectors }: { sectors: SectorBests[] }) {
  if (sectors.length < 2) return null;

  const best: [number, number, number] = [
    Math.min(...sectors.map((s) => s.s1)),
    Math.min(...sectors.map((s) => s.s2)),
    Math.min(...sectors.map((s) => s.s3)),
  ];
  const ideal = Number(best.reduce((a, b) => a + b, 0).toFixed(3));

  const rows: Row[] = sectors
    .map((s) => {
      const bests: [number, number, number] = [s.s1, s.s2, s.s3];
      const losses = bests.map((v, i) => Number((v - best[i]).toFixed(3))) as [number, number, number];
      const row: Row = {
        driver: s.driver, bests, losses,
        theoretical: Number((s.s1 + s.s2 + s.s3).toFixed(3)),
        total: Number(losses.reduce((a, b) => a + b, 0).toFixed(3)),
      };
      losses.forEach((v, i) => { row[`l${i}`] = v; });
      return row;
    })
    .sort((a, b) => a.total - b.total);

  const worst = rows[rows.length - 1].total;

  return (
    <ChartFrame
      label="SECTOR PERFORMANCE"
      title="Where the time goes"
      note={`Each driver's best in each sector against the fastest anyone managed there. The ideal lap — every sector's best combined — is ${formatLap(ideal)}. Bests are taken independently, so these are laps nobody actually drove; a driver holding a sector best simply has no segment for it.`}
      legend={
        <div className="flex flex-wrap gap-3">
          {SECTOR_LABELS.map((l, i) => (
            <span key={l} className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 8, height: 8, background: SECTOR_COLORS[i], display: "inline-block" }} />
              <span className="label">{l}</span>
            </span>
          ))}
        </div>
      }
      table={
        <DataTable
          caption="Best sector times and time lost"
          columns={["Driver", "S1", "S2", "S3", "Theoretical", "Lost"]}
          rows={rows.map((r) => [
            r.driver, r.bests[0].toFixed(3), r.bests[1].toFixed(3), r.bests[2].toFixed(3),
            formatLap(r.theoretical), r.total === 0 ? "—" : `+${r.total.toFixed(3)}`,
          ])}
        />
      }
    >
      <div style={{ minWidth: 460, height: rows.length * 18 + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 50, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis
              type="number" domain={[0, Math.ceil(worst * 2) / 2]}
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
              formatter={(v, n) => [`+${Number(v).toFixed(3)}s`, SECTOR_LABELS[Number(String(n).slice(1))] ?? String(n)]}
            />
            {[0, 1, 2].map((i) => (
              <Bar key={i} dataKey={`l${i}`} stackId="sectors" isAnimationActive={false} shape={makeSegment(i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
