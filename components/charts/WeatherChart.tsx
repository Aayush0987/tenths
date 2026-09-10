"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeatherSample } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, SERIES_COLORS } from "@/lib/charts/palette";

/** Contiguous runs where rain was falling, for shading behind the lines. */
function rainBands(samples: WeatherSample[]) {
  const bands: { from: number; to: number }[] = [];
  let start: number | null = null;
  for (const s of samples) {
    if (s.minutes === null) continue;
    if (s.rain) { if (start === null) start = s.minutes; }
    else if (start !== null) { bands.push({ from: start, to: s.minutes }); start = null; }
  }
  const last = samples[samples.length - 1];
  if (start !== null && last?.minutes != null) bands.push({ from: start, to: last.minutes });
  return bands;
}

export default function WeatherChart({ weather }: { weather: WeatherSample[] }) {
  const samples = weather.filter((s) => s.minutes !== null);
  if (samples.length < 5) return null;

  const temps = samples.flatMap((s) => [s.airTemp, s.trackTemp]).filter((v): v is number => v !== null);
  if (temps.length === 0) return null;
  const bands = rainBands(samples);
  const air = samples.map((s) => s.airTemp).filter((v): v is number => v !== null);
  const track = samples.map((s) => s.trackTemp).filter((v): v is number => v !== null);

  return (
    <ChartFrame
      label="CONDITIONS"
      title="Track & air temperature"
      note={
        bands.length > 0
          ? "Shaded stretches are rain. Track temperature drives how quickly tyres give up, and it moves far more than air temperature does."
          : "Track temperature drives how quickly tyres give up, and it moves far more than air temperature does — cloud cover alone can shift it several degrees."
      }
      legend={
        <div className="flex flex-wrap gap-4">
          {[["TRACK", SERIES_COLORS[1], track], ["AIR", SERIES_COLORS[0], air]].map(([label, color, range]) => (
            <span key={String(label)} className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 8, height: 8, background: String(color), display: "inline-block" }} />
              <span className="label">{String(label)}</span>
              <span className="num" style={{ fontSize: "var(--text-micro)", color: "var(--ink-faint)" }}>
                {Math.min(...(range as number[])).toFixed(0)}–{Math.max(...(range as number[])).toFixed(0)}°
              </span>
            </span>
          ))}
          {bands.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 8, height: 8, background: "var(--border-strong)", display: "inline-block" }} />
              <span className="label">Rain</span>
            </span>
          )}
        </div>
      }
      table={
        <DataTable
          caption="Track and air conditions through the session"
          columns={["Minute", "Track", "Air", "Humidity", "Wind", "Rain"]}
          rows={samples.filter((_, i) => i % 10 === 0).map((s) => [
            Math.round(s.minutes ?? 0), s.trackTemp?.toFixed(1) ?? null, s.airTemp?.toFixed(1) ?? null,
            s.humidity !== null ? `${s.humidity.toFixed(0)}%` : null,
            s.windSpeed?.toFixed(1) ?? null, s.rain ? "yes" : "—",
          ])}
        />
      }
    >
      <div style={{ minWidth: 460, height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={samples} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            {bands.map((b) => (
              <ReferenceArea key={`${b.from}-${b.to}`} x1={b.from} x2={b.to}
                             fill="var(--border-strong)" fillOpacity={0.45} stroke="none" />
            ))}
            <XAxis
              dataKey="minutes" type="number" domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
              tickFormatter={(v: number) => `${Math.round(v)}m`}
            />
            <YAxis
              domain={[Math.floor(Math.min(...temps) / 5) * 5, Math.ceil(Math.max(...temps) / 5) * 5]}
              width={36} tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `${v}°`}
            />
            <Tooltip
              cursor={{ stroke: CHART_INK.grid, strokeWidth: 1 }}
              contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)", fontSize: 11 }}
              labelFormatter={(m) => `${Math.round(Number(m))} min`}
              formatter={(v, n) => [`${Number(v).toFixed(1)}°C`, n === "trackTemp" ? "Track" : "Air"]}
            />
            <Line type="monotone" dataKey="trackTemp" stroke={SERIES_COLORS[1]} strokeWidth={1.75}
                  dot={false} activeDot={{ r: 2.5, strokeWidth: 0 }} isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="airTemp" stroke={SERIES_COLORS[0]} strokeWidth={1.75}
                  dot={false} activeDot={{ r: 2.5, strokeWidth: 0 }} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
