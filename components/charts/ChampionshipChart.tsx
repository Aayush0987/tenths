"use client";

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import { CHART_INK, FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";
import type { Standings } from "@/lib/analysis/championship";

/**
 * Ten lines is already a lot. Beyond that the lines below are flat and
 * overlapping and add nothing to the question the chart answers, which is how
 * the title was won.
 */
const SHOWN = 10;

interface Props {
  standings: Standings;
  season: number;
}

export default function ChampionshipChart({ standings, season }: Props) {
  const shown = standings.drivers.slice(0, SHOWN);

  /**
   * Teammates share a team colour, so within a team the second driver is
   * dashed. That is the secondary encoding the palette rule requires: colour
   * says which team, the dash and the end label say which driver.
   */
  const seen = new Set<string>();
  const series = shown.map((d) => {
    const second = seen.has(d.team);
    seen.add(d.team);
    return { ...d, dashed: second, color: d.teamColor ?? FALLBACK_TEAM_COLOR };
  });

  const data = standings.rounds.map((round, i) => {
    const point: Record<string, number | string> = { round };
    for (const d of series) point[d.code] = d.running[i] ?? 0;
    return point;
  });

  // Recharts' automatic domain rounds up to a "nice" number that left a
  // third of the plot empty above the leader's total. Anchored at zero, which
  // a cumulative count belongs at, and topped just above the winning score.
  const top = Math.max(1, ...series.map((d) => d.points));

  const leader = series[0];
  const runnerUp = series[1];
  const margin = leader && runnerUp ? leader.points - runnerUp.points : null;

  return (
    <ChartFrame
      label="CHAMPIONSHIP"
      title={`${season} points progression`}
      note={
        <>
          Cumulative points after each round, sprints included. Top {SHOWN} of{" "}
          {standings.drivers.length} drivers.{" "}
          {margin !== null && (
            <>
              {leader.code} took it by {margin} point{margin === 1 ? "" : "s"} from{" "}
              {runnerUp.code}.{" "}
            </>
          )}
          A driver who missed a round holds their total rather than dropping out, so a
          flat section means an absence or a blank, not a retirement from the
          championship. Teammates share a colour; the second is dashed.
        </>
      }
      legend={
        <ul className="flex flex-wrap gap-x-3 gap-y-1" style={{ listStyle: "none" }}>
          {series.map((d) => (
            <li key={d.code} className="flex items-center gap-1.5">
              <svg width="16" height="8" aria-hidden="true">
                <line
                  x1="0" y1="4" x2="16" y2="4"
                  stroke={d.color} strokeWidth="2"
                  strokeDasharray={d.dashed ? "3 2" : undefined}
                />
              </svg>
              <span className="label" style={{ color: "var(--ink)" }}>{d.code}</span>
              <span className="num" style={{ color: "var(--ink-faint)" }}>{d.points}</span>
            </li>
          ))}
        </ul>
      }
      table={
        <DataTable
          caption={`${season} drivers' championship`}
          columns={["Driver", "Team", "Points", "Wins", "Podiums", "Poles", "Starts", "DNF"]}
          rows={standings.drivers.map((d) => [
            `${d.code} ${d.name}`, d.team, d.points, d.wins, d.podiums,
            d.poles, d.starts, d.dnfs,
          ])}
        />
      }
    >
      <div style={{ minWidth: 560 }}>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 6, right: 44, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            <XAxis
              dataKey="round" tick={{ fontSize: 10, fill: CHART_INK.axis }}
              stroke={CHART_INK.grid} tickLine={false}
              label={{ value: "ROUND", position: "insideBottomRight", offset: -2,
                       fontSize: 9, fill: CHART_INK.axis, letterSpacing: 1 }}
            />
            <YAxis
              domain={[0, Math.ceil((top * 1.04) / 25) * 25]}
              tick={{ fontSize: 10, fill: CHART_INK.axis }}
              stroke={CHART_INK.grid} tickLine={false} width={40}
              label={{ value: "POINTS", angle: -90, position: "insideLeft",
                       fontSize: 9, fill: CHART_INK.axis, letterSpacing: 1 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)", border: "1px solid var(--border)",
                fontSize: 11, padding: "6px 8px",
              }}
              labelFormatter={(round) => `Round ${round}`}
              itemSorter={(item) => -(item.value as number)}
            />
            {series.map((d) => (
              <Line
                key={d.code} type="monotone" dataKey={d.code}
                stroke={d.color} strokeWidth={2}
                strokeDasharray={d.dashed ? "4 3" : undefined}
                dot={false} activeDot={{ r: 3 }} isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
