"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Compound, Stint } from "@/types/data";
import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import {
  CHART_INK, COMPOUND_INITIALS, COMPOUND_LABELS, COMPOUND_ORDER,
  compoundColor, compoundTextColor,
} from "@/lib/charts/palette";

interface Props {
  stints: Stint[];
  totalLaps: number;
  /** Driver codes in finishing order, so rows read like a results sheet. */
  driverOrder: string[];
}

interface Row {
  driver: string;
  compounds: Compound[];
  stints: Stint[];
  [key: string]: unknown;
}

const ROW_HEIGHT = 18;
const AXIS_BAND = 28;
/** Below this a letter would be clipped, so it is dropped. */
const MIN_LABEL_WIDTH = 14;

function buildRows(stints: Stint[], driverOrder: string[]): Row[] {
  const byDriver = new Map<string, Stint[]>();
  for (const s of stints) {
    const list = byDriver.get(s.driver) ?? [];
    list.push(s);
    byDriver.set(s.driver, list);
  }
  const ordered = [
    ...driverOrder.filter((d) => byDriver.has(d)),
    ...[...byDriver.keys()].filter((d) => !driverOrder.includes(d)).sort(),
  ];
  const maxStints = Math.max(0, ...ordered.map((d) => (byDriver.get(d) ?? []).length));

  return ordered.map((driver) => {
    const ds = (byDriver.get(driver) ?? []).sort((a, b) => a.stint - b.stint);
    const row: Row = { driver, compounds: ds.map((s) => s.compound), stints: ds };
    for (let i = 0; i < maxStints; i++) row[`s${i}`] = ds[i]?.laps ?? 0;
    return row;
  });
}

interface ShapeProps {
  x?: number; y?: number; width?: number; height?: number; payload?: Row;
}

/**
 * One stint segment: fill, a surface-coloured gap, and the compound initial
 * where it fits.
 *
 * A custom shape rather than <Cell> plus <LabelList>, because Recharts matches
 * those to *rendered* rectangles and renders nothing for a zero-length one — a
 * driver with fewer stints than the maximum shifts every later row's colour
 * and label. A shape receives its own row and cannot be misaligned.
 */
function makeSegment(index: number) {
  function Segment({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
    const compound = payload?.compounds[index];
    if (!compound || width <= 0) return null;
    return (
      <g>
        <rect
          x={x} y={y} width={width} height={height}
          fill={compoundColor(compound)}
          stroke={CHART_INK.surface}
          strokeWidth={2}
        />
        {width >= MIN_LABEL_WIDTH && (
          <text
            x={x + width / 2} y={y + height / 2}
            textAnchor="middle" dominantBaseline="central"
            fontSize={8} fontWeight={800}
            fill={compoundTextColor(compound)} pointerEvents="none"
          >
            {COMPOUND_INITIALS[compound]}
          </text>
        )}
      </g>
    );
  }
  Segment.displayName = `Segment${index}`;
  return Segment;
}

function StintTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--surface-raised)", border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-md)", padding: "7px 9px", fontSize: "var(--text-small)",
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 3 }}>{row.driver}</p>
      {row.stints.map((s) => (
        <p key={s.stint} style={{ color: "var(--ink-muted)", lineHeight: 1.5 }}>
          <span
            style={{ display: "inline-block", width: 7, height: 7, marginRight: 6,
                     background: compoundColor(s.compound) }}
          />
          {COMPOUND_LABELS[s.compound] ?? s.compound}
          <span className="num"> · {s.lapStart}–{s.lapEnd} ({s.laps})</span>
        </p>
      ))}
    </div>
  );
}

export default function TyreStrategyChart({ stints, totalLaps, driverOrder }: Props) {
  const rows = buildRows(stints, driverOrder);
  if (rows.length === 0) return null;
  const maxStints = Math.max(...rows.map((r) => r.compounds.length));
  const present = COMPOUND_ORDER.filter((c) => stints.some((s) => s.compound === c));

  const legend = (
    <div className="flex flex-wrap gap-3">
      {present.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span aria-hidden="true" style={{ width: 8, height: 8, background: compoundColor(c), display: "inline-block" }} />
          <span className="label">{COMPOUND_LABELS[c]}</span>
        </span>
      ))}
    </div>
  );

  const table = (
    <DataTable
      caption="Tyre stints by driver"
      columns={["Driver", "Stint", "Compound", "Laps"]}
      rows={rows.flatMap((r) =>
        r.stints.map((s) => [r.driver, s.stint, COMPOUND_LABELS[s.compound] ?? s.compound, `${s.lapStart}–${s.lapEnd} (${s.laps})`]),
      )}
    />
  );

  return (
    <ChartFrame
      label="STRATEGY"
      title="Tyre stints"
      note="Each row is one driver's race, left to right. A letter appears where the stint is long enough to hold one."
      legend={legend}
      table={table}
    >
      <div style={{ minWidth: 520, height: rows.length * ROW_HEIGHT + AXIS_BAND }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis
              type="number" domain={[0, totalLaps]}
              tick={{ fontSize: 9, fill: CHART_INK.axis }} tickLine={false}
              axisLine={{ stroke: CHART_INK.grid }}
            />
            <YAxis
              type="category" dataKey="driver" width={34} interval={0}
              tick={{ fontSize: 9, fill: CHART_INK.label, fontWeight: 700 }}
              tickLine={false} axisLine={false}
            />
            <Tooltip content={<StintTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
            {Array.from({ length: maxStints }, (_, i) => (
              <Bar key={i} dataKey={`s${i}`} stackId="stints" isAnimationActive={false} shape={makeSegment(i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
