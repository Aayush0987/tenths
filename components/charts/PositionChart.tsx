"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Driver, Lap } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";
import { lapsByDriver } from "@/lib/analysis/selectors";

interface LapRow { lap: number; [driver: string]: number | undefined }

export default function PositionChart({
  laps, drivers, totalLaps, driverOrder,
}: { laps: Lap[]; drivers: Driver[]; totalLaps: number; driverOrder: string[] }) {
  const byDriver = lapsByDriver(laps);
  const series = [...byDriver.entries()]
    .map(([driver, ls]) => ({ driver, points: ls.filter((l) => l.position !== null) }))
    .filter((s) => s.points.length > 0);
  if (series.length < 2) return null;

  const rows: LapRow[] = [];
  for (let lap = 1; lap <= totalLaps; lap++) rows.push({ lap });
  for (const s of series) {
    for (const p of s.points) {
      const row = rows[p.lap - 1];
      if (row) row[s.driver] = p.position as number;
    }
  }

  const colorOf = new Map(drivers.map((d) => [d.code, d.teamColor ?? FALLBACK_TEAM_COLOR]));
  const maxPosition = Math.max(...series.flatMap((s) => s.points.map((p) => p.position as number)));

  /**
   * The right axis carries the finishing order, so each line is named where
   * the eye already looks for a result. The order comes from the
   * classification rather than each line's last point: a driver who retires
   * stops partway through, so several lines end on the same position and would
   * overwrite each other.
   */
  const finalOrder = new Map<number, string>();
  driverOrder.forEach((code, i) => finalOrder.set(i + 1, code));

  return (
    <ChartFrame
      label="RACE PROGRESSION"
      title="Position changes"
      note="Every driver's position, lap by lap. First is at the top; codes on the right are the finishing order. Lines converging usually means a safety car."
      table={
        <DataTable
          caption="Start and finish position by driver"
          columns={["Driver", "Start", "Finish", "Change"]}
          rows={series
            .map((s) => {
              const start = s.points[0]?.position as number;
              const finish = s.points[s.points.length - 1]?.position as number;
              return { driver: s.driver, start, finish, change: start - finish };
            })
            .sort((a, b) => a.finish - b.finish)
            .map((r) => [r.driver, r.start, r.finish, r.change === 0 ? "—" : r.change > 0 ? `+${r.change}` : String(r.change)])}
        />
      }
    >
      <div style={{ minWidth: 560, height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 6, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="lap" type="number" domain={[1, totalLaps]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
            />
            <YAxis
              type="number" reversed domain={[1, maxPosition]}
              ticks={Array.from({ length: maxPosition }, (_, i) => i + 1)}
              width={22} interval={0}
              tick={{ fontSize: 8, fill: CHART_INK.axis }} tickLine={false} axisLine={false}
            />
            {/* Recharts renders a YAxis only when a series references it, and
                that series must carry position values — one ranging over lap
                numbers widens the domain and squeezes every label into the
                top third of the plot. */}
            <YAxis
              yAxisId="finish" orientation="right" type="number" reversed
              domain={[1, maxPosition]}
              ticks={Array.from({ length: maxPosition }, (_, i) => i + 1)}
              width={30} interval={0} tickLine={false} axisLine={false}
              tick={{ fontSize: 8, fill: CHART_INK.label, fontWeight: 700 }}
              tickFormatter={(p: number) => finalOrder.get(p) ?? ""}
            />
            <Tooltip
              cursor={{ stroke: CHART_INK.grid, strokeWidth: 1 }}
              contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)", fontSize: 11 }}
              labelFormatter={(l) => `Lap ${l}`}
              formatter={(v, n) => [`P${v}`, String(n)]}
            />
            <Line
              yAxisId="finish" dataKey={series[0].driver} stroke="none"
              dot={false} activeDot={false} isAnimationActive={false} legendType="none"
            />
            {series.map((s) => (
              <Line
                key={s.driver} type="linear" dataKey={s.driver}
                stroke={colorOf.get(s.driver) ?? FALLBACK_TEAM_COLOR}
                strokeWidth={1.25} dot={false} activeDot={{ r: 2.5, strokeWidth: 0 }}
                isAnimationActive={false} connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
