"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SectorBests } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { makeDotShape } from "@/components/charts/dotPlotShape";
import { CHART_ACCENT, CHART_INK } from "@/lib/charts/palette";

interface Row { driver: string; kph: number; down: number; [k: string]: unknown }

export default function SpeedTrapChart({ sectors }: { sectors: SectorBests[] }) {
  const withTrap = sectors.filter((s): s is SectorBests & { speedTrapKph: number } => s.speedTrapKph !== null);
  if (withTrap.length < 3) return null;

  const fastest = Math.max(...withTrap.map((s) => s.speedTrapKph));
  const rows: Row[] = withTrap
    .map((s) => ({ driver: s.driver, kph: s.speedTrapKph, down: Number((fastest - s.speedTrapKph).toFixed(1)) }))
    .sort((a, b) => b.kph - a.kph);

  // Fitted to the data, not rounded outwards: a 15km/h spread inside a 30km/h
  // axis bunches every dot into the left half.
  const floor = Math.floor(rows[rows.length - 1].kph) - 2;
  const ceiling = Math.ceil(fastest) + 2;

  return (
    <ChartFrame
      label="STRAIGHT LINE"
      title="Speed trap"
      note="The fastest each driver was clocked through the trap. It reads engine and wing level more than driving — a car low on downforce gains here and gives it back in the corners — which is why the order rarely matches the result."
      table={
        <DataTable
          caption="Best speed trap reading by driver"
          columns={["Driver", "Speed trap", "Down on fastest"]}
          rows={rows.map((r) => [r.driver, `${r.kph.toFixed(0)} km/h`, r.down === 0 ? "—" : `−${r.down.toFixed(0)}`])}
        />
      }
    >
      <div style={{ minWidth: 420, height: rows.length * 18 + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 58, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis
              type="number" domain={[floor, ceiling]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
            />
            <YAxis
              type="category" dataKey="driver" width={34} interval={0}
              tick={{ fontSize: 9, fill: CHART_INK.label, fontWeight: 700 }}
              tickLine={false} axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-hover)" }}
              contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)", fontSize: 11 }}
              formatter={(v) => [`${Number(v).toFixed(0)} km/h`, "Trap"]}
            />
            <Bar
              dataKey="kph" isAnimationActive={false}
              shape={makeDotShape<Row>({
                floor, ceiling, color: CHART_ACCENT,
                value: (r) => r.kph,
                label: (r) => `${r.kph.toFixed(0)} km/h`,
              })}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
