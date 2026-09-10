"use client";

import ChartFrame from "@/components/charts/ChartFrame";
import DataTable from "@/components/charts/DataTable";
import LapTraceCharts from "@/components/charts/LapTraceCharts";
import type { LapComparison } from "@/lib/analysis/lapCompare";
import { formatLap } from "@/lib/format";

interface Props {
  comparison: LapComparison;
  location: string;
  earlier: { season: number; driver: string };
  later: { season: number; driver: string };
}

/**
 * The same circuit, two seasons, one lap each.
 *
 * This is the comparison a single-season site cannot make: the quickest lap
 * anyone managed here in one year against the quickest in another, on the same
 * axis, so where the time went is visible rather than inferred from a total.
 *
 * The two laps are compared at the same fraction of their own lap rather than
 * at the same metre mark. Cars from different seasons take different lines and
 * the traces are sampled independently, so their recorded lengths differ by
 * enough to matter; matching absolute distance leaves one lap short of the line
 * when the other has crossed it, and the delta ends somewhere that is not the
 * difference between the lap times.
 *
 * What it is not is a like-for-like measure of machinery. Between seasons the
 * regulations, the tyres and often the surface all changed, and the drivers
 * are not the same two people. It shows how the circuit's fastest lap moved,
 * which is a real thing, and not why.
 */
export default function EraCompare({ comparison, location, earlier, later }: Props) {
  const { points, lapA, lapB } = comparison;
  if (points.length < 10 || lapA === null || lapB === null) return null;

  const difference = lapB - lapA;
  const slower = difference > 0;

  return (
    <ChartFrame
      label="SEASON AGAINST SEASON"
      title={`${earlier.season} against ${later.season}`}
      note={
        <>
          The quickest qualifying lap of each season at {location}:{" "}
          {earlier.driver} {formatLap(lapA)} in {earlier.season}, {later.driver}{" "}
          {formatLap(lapB)} in {later.season} — {Math.abs(difference).toFixed(3)}s{" "}
          {slower ? "slower" : "quicker"}. The delta below shows where that went; above
          the line means {later.season} is behind. Compared at the same fraction of each
          lap rather than the same metre, because the two traces record slightly
          different lengths and matching absolute distance would leave one lap short of
          the line. Different regulations, tyres and drivers, so this is how the
          circuit&rsquo;s fastest lap moved, not a measure of the cars.
        </>
      }
      legend={
        <ul className="flex flex-wrap gap-x-3 gap-y-1" style={{ listStyle: "none" }}>
          {[
            { label: `${earlier.season} · ${earlier.driver}`, colour: "var(--series-1)" },
            { label: `${later.season} · ${later.driver}`, colour: "var(--series-2)" },
          ].map((k) => (
            <li key={k.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 14, height: 2, background: k.colour, display: "inline-block" }} />
              <span className="label" style={{ color: "var(--ink)" }}>{k.label}</span>
            </li>
          ))}
        </ul>
      }
      table={
        <DataTable
          caption={`Fastest qualifying lap at ${location}, ${earlier.season} against ${later.season}`}
          columns={["Season", "Driver", "Lap", "Difference"]}
          rows={[
            [earlier.season, earlier.driver, formatLap(lapA), "—"],
            [
              later.season, later.driver, formatLap(lapB),
              `${difference > 0 ? "+" : ""}${difference.toFixed(3)}s`,
            ],
          ]}
        />
      }
    >
      <LapTraceCharts
        points={points}
        codeA={String(earlier.season)}
        codeB={String(later.season)}
      />
    </ChartFrame>
  );
}
