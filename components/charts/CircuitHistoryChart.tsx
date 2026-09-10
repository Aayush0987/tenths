"use client";

import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";

import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, SERIES_COLORS } from "@/lib/charts/palette";
import { formatLap } from "@/lib/format";

export interface CircuitYear {
  season: number;
  round: number;
  raceName: string;
  date: string | null;
  totalLaps: number;
  poleDriver: string | null;
  poleSeconds: number | null;
  poleLabel: string | null;
  fastestDriver: string | null;
  fastestSeconds: number | null;
  fastestLabel: string | null;
  winner: string | null;
  stopsPerCar: number | null;
  finishers: number;
  entries: number;
}

/**
 * How a circuit's lap times moved from season to season.
 *
 * Pole and fastest race lap share one axis because both are lap times in
 * seconds. Stops per car is a different measure entirely and gets its own
 * chart below rather than a second y-scale on this one — a dual axis would
 * invent a relationship between seconds and pit stops that does not exist,
 * and the crossing point would move with whatever range each axis happened to
 * be given.
 *
 * The y-axis does not start at zero. Zero seconds is not a lap, and including
 * it would compress a swing of several seconds into a flat line. It is a
 * comparison of positions on a scale, not of magnitudes against nothing.
 */
export default function CircuitHistoryChart({
  years,
  location,
}: {
  years: CircuitYear[];
  location: string;
}) {
  const times = years.flatMap((y) =>
    [y.poleSeconds, y.fastestSeconds].filter((v): v is number => v !== null),
  );
  const hasTimes = times.length > 0;
  const low = Math.min(...times);
  const high = Math.max(...times);
  const pad = Math.max(0.4, (high - low) * 0.15);

  const data = years.map((y) => ({
    season: String(y.season),
    pole: y.poleSeconds,
    fastest: y.fastestSeconds,
    stops: y.stopsPerCar,
    raw: y,
  }));

  return (
    <>
      <ChartFrame
        label="LAP TIME"
        title={`${location}, season to season`}
        note={
          <>
            Pole and the fastest clean race lap, both in seconds, on a shared axis. The
            axis does not start at zero — zero is not a lap time, and anchoring there
            would flatten the whole comparison. Different seasons ran different
            regulations and different tyres, so this shows how the circuit&rsquo;s times
            moved, not how the drivers compared.
          </>
        }
        legend={
          <ul className="flex flex-wrap gap-x-3 gap-y-1" style={{ listStyle: "none" }}>
            {[
              { label: "Pole", color: SERIES_COLORS[0] },
              { label: "Fastest race lap", color: SERIES_COLORS[1] },
            ].map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <svg width="16" height="8" aria-hidden="true">
                  <line x1="0" y1="4" x2="16" y2="4" stroke={s.color} strokeWidth="2" />
                </svg>
                <span className="label" style={{ color: "var(--ink)" }}>{s.label}</span>
              </li>
            ))}
          </ul>
        }
        table={
          <DataTable
            caption={`Pole and fastest lap at ${location} by season`}
            columns={["Season", "Pole", "Pole time", "Fastest lap", "Time", "Stops/car"]}
            rows={years.map((y) => [
              y.season, y.poleDriver ?? "—", y.poleLabel ?? "—",
              y.fastestDriver ?? "—", y.fastestLabel ?? "—", y.stopsPerCar ?? "—",
            ])}
          />
        }
      >
        {hasTimes ? (
          <div style={{ minWidth: 420 }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
                <XAxis dataKey="season" tick={{ fontSize: 10, fill: CHART_INK.axis }}
                       stroke={CHART_INK.grid} tickLine={false} />
                <YAxis
                  domain={[low - pad, high + pad]}
                  tick={{ fontSize: 10, fill: CHART_INK.axis }}
                  stroke={CHART_INK.grid} tickLine={false} width={54}
                  tickFormatter={(v: number) => formatLap(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    fontSize: 11, padding: "6px 8px",
                  }}
                  formatter={(value, name, item) => {
                    const y = (item?.payload as (typeof data)[number])?.raw;
                    if (value === null || value === undefined) return ["—", String(name)];
                    const who = name === "pole" ? y?.poleDriver : y?.fastestDriver;
                    return [
                      `${formatLap(value as number)}${who ? ` · ${who}` : ""}`,
                      name === "pole" ? "Pole" : "Fastest lap",
                    ];
                  }}
                />
                <Line type="linear" dataKey="pole" stroke={SERIES_COLORS[0]} strokeWidth={2}
                      dot={{ r: 3, fill: SERIES_COLORS[0], strokeWidth: 0 }}
                      connectNulls={false} isAnimationActive={false} />
                <Line type="linear" dataKey="fastest" stroke={SERIES_COLORS[1]} strokeWidth={2}
                      dot={{ r: 3, fill: SERIES_COLORS[1], strokeWidth: 0 }}
                      connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-small)", color: "var(--ink-muted)", padding: "20px 0" }}>
            No qualifying or lap times recorded for this circuit.
          </p>
        )}
      </ChartFrame>

      <ChartFrame
        label="STRATEGY"
        title="Pit stops per car"
        note="Its own chart rather than a second axis on the lap times above — seconds and stops do not share a scale, and drawing them together would imply a relationship that is an artefact of the axis ranges."
        table={
          <DataTable
            caption={`Pit stops per car at ${location} by season`}
            columns={["Season", "Stops per car", "Finishers", "Laps"]}
            rows={years.map((y) => [
              y.season, y.stopsPerCar ?? "—", `${y.finishers}/${y.entries}`, y.totalLaps,
            ])}
          />
        }
      >
        <div style={{ minWidth: 420 }}>
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
              <XAxis dataKey="season" tick={{ fontSize: 10, fill: CHART_INK.axis }}
                     stroke={CHART_INK.grid} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: CHART_INK.axis }} stroke={CHART_INK.grid}
                     tickLine={false} width={34} allowDecimals />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  fontSize: 11, padding: "6px 8px",
                }}
                formatter={(value) => [String(value ?? "—"), "Stops per car"]}
              />
              <Bar dataKey="stops" fill={CHART_INK.label} maxBarSize={26}
                   isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </>
  );
}
