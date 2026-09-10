"use client";

import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";

import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, SERIES_COLORS } from "@/lib/charts/palette";
import type { RaceData } from "@/types/data";

/**
 * Where a driver started against where they finished, round by round.
 *
 * Two series on one axis — both are grid positions, so they share a scale
 * honestly. The axis is inverted because P1 belongs at the top; a chart where
 * winning points downward is read backwards by everyone who knows the sport.
 *
 * A retirement is a gap, not a zero and not a twentieth place. Recharts joins
 * across nulls by default, which would draw a line straight through the
 * missing race as though it had been finished mid-pack, so connectNulls is
 * off.
 */
export default function DriverSeasonChart({
  races,
  code,
  color,
}: {
  races: RaceData[];
  code: string;
  color: string;
}) {
  const data = races.map((race) => {
    const result = race.results.find((r) => r.driver === code);
    const grid = result?.grid ?? null;
    return {
      key: `${race.season}.${String(race.round).padStart(2, "0")}`,
      season: race.season,
      round: race.round,
      name: race.raceName.replace(" Grand Prix", ""),
      // Grid 0 is a pit lane start, which is not position zero at the top of
      // the chart. Plotted as null and called out in the tooltip instead.
      grid: grid === 0 ? null : grid,
      pitStart: grid === 0,
      finish: result?.position ?? null,
      status: result?.position === null ? (result?.status ?? "DNF") : null,
    };
  });

  // A rule between seasons, so a three-year run does not read as one long one.
  const boundaries = data
    .map((d, i) => ({ key: d.key, season: d.season, i }))
    .filter((d, i, arr) => i > 0 && arr[i - 1].season !== d.season);

  const finishes = data.map((d) => d.finish).filter((p): p is number => p !== null);
  const grids = data.map((d) => d.grid).filter((p): p is number => p !== null);
  const worst = Math.max(1, ...finishes, ...grids);

  const gained = data.filter((d) => d.grid !== null && d.finish !== null && d.grid > d.finish).length;
  const lost = data.filter((d) => d.grid !== null && d.finish !== null && d.grid < d.finish).length;
  const dnfs = data.filter((d) => d.finish === null).length;

  return (
    <ChartFrame
      label="GRID VS FINISH"
      title="Started, finished"
      note={
        <>
          Position axis inverted so first is at the top. Gained places in {gained} race
          {gained === 1 ? "" : "s"}, lost in {lost}
          {dnfs > 0 && <>, and did not finish {dnfs}</>}. A retirement is drawn as a break
          rather than as last place — a car that stopped on lap 3 did not finish
          twentieth. A pit lane start has no grid slot and is left out of the grid line.
        </>
      }
      legend={
        <ul className="flex flex-wrap gap-x-3 gap-y-1" style={{ listStyle: "none" }}>
          {[
            { label: "Grid", color: SERIES_COLORS[0], dashed: true },
            { label: "Finish", color, dashed: false },
          ].map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="16" y2="4" stroke={s.color} strokeWidth="2"
                      strokeDasharray={s.dashed ? "3 2" : undefined} />
              </svg>
              <span className="label" style={{ color: "var(--ink)" }}>{s.label}</span>
            </li>
          ))}
        </ul>
      }
      table={
        <DataTable
          caption={`${code} grid and finishing position by round`}
          columns={["Race", "Season", "Round", "Grid", "Finish", "Status"]}
          rows={data.map((d) => [
            d.name, d.season, d.round,
            d.pitStart ? "Pit lane" : d.grid ?? "—",
            d.finish ?? "—",
            d.status ?? "Classified",
          ])}
        />
      }
    >
      <div style={{ minWidth: Math.max(560, data.length * 13) }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            <XAxis
              dataKey="key" tick={{ fontSize: 9, fill: CHART_INK.axis }}
              stroke={CHART_INK.grid} tickLine={false} interval="preserveStartEnd"
              tickFormatter={(k: string) => k.split(".")[1].replace(/^0/, "")}
            />
            <YAxis
              reversed domain={[1, worst]} allowDecimals={false}
              tick={{ fontSize: 10, fill: CHART_INK.axis }}
              stroke={CHART_INK.grid} tickLine={false} width={30}
              label={{ value: "POSITION", angle: -90, position: "insideLeft",
                       fontSize: 9, fill: CHART_INK.axis, letterSpacing: 1 }}
            />
            {boundaries.map((b) => (
              <ReferenceLine
                key={b.key} x={b.key} stroke={CHART_INK.axis} strokeDasharray="2 3"
                label={{ value: String(b.season), position: "insideTopLeft",
                         fontSize: 9, fill: CHART_INK.axis }}
              />
            ))}
            <Tooltip
              contentStyle={{
                background: "var(--surface)", border: "1px solid var(--border)",
                fontSize: 11, padding: "6px 8px",
              }}
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload as (typeof data)[number] | undefined;
                return d ? `${d.season} · ${d.name}` : "";
              }}
              formatter={(value, name, item) => {
                const d = item?.payload as (typeof data)[number] | undefined;
                if (name === "grid" && d?.pitStart) return ["Pit lane", "Grid"];
                if (name === "finish" && value === null) return [d?.status ?? "DNF", "Finish"];
                return [value as number, name === "grid" ? "Grid" : "Finish"];
              }}
            />
            <Line
              type="linear" dataKey="grid" stroke={SERIES_COLORS[0]} strokeWidth={2}
              strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false}
            />
            <Line
              type="linear" dataKey="finish" stroke={color} strokeWidth={2}
              dot={{ r: 2, fill: color, strokeWidth: 0 }} activeDot={{ r: 4 }}
              connectNulls={false} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
