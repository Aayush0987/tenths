import Link from "next/link";

import SectionHeading from "@/components/ui/SectionHeading";
import type { CircuitRecords as Records } from "@/lib/analysis/circuit";
import { formatLap } from "@/lib/format";

/**
 * Records at this circuit.
 *
 * Scoped to the seasons this site holds, and the heading says so. A circuit
 * that has run since the fifties has a real lap record set long before any of
 * this data, and presenting a 2024 time as "the lap record" would be a claim
 * the data cannot support. Naming the window is the whole difference between
 * a fact and a mistake.
 */
export default function CircuitRecords({
  records,
  leaders,
  seasons,
}: {
  records: Records;
  leaders: { driver: string; points: number; starts: number; best: number | null }[];
  seasons: number[];
}) {
  const window = seasons.length > 1
    ? `${Math.min(...seasons)}–${Math.max(...seasons)}`
    : String(seasons[0] ?? "");

  const driverLink = (code: string) => (
    <Link href={`/driver/${code}`} className="num" style={{ color: "inherit", fontWeight: 650 }}>
      {code}
    </Link>
  );

  const entries: { label: string; value: React.ReactNode; note?: string }[] = [
    {
      label: "Fastest qualifying lap",
      value: records.fastestQualifying ? (
        <>
          {driverLink(records.fastestQualifying.driver)}{" "}
          <span className="num">{formatLap(records.fastestQualifying.seconds)}</span>
        </>
      ) : "—",
      note: records.fastestQualifying ? String(records.fastestQualifying.season) : undefined,
    },
    {
      label: "Fastest race lap",
      value: records.fastestRaceLap ? (
        <>
          {driverLink(records.fastestRaceLap.driver)}{" "}
          <span className="num">{formatLap(records.fastestRaceLap.seconds)}</span>
        </>
      ) : "—",
      note: records.fastestRaceLap ? String(records.fastestRaceLap.season) : undefined,
    },
    {
      label: "Highest speed trap",
      value: records.topSpeed ? (
        <>
          {driverLink(records.topSpeed.driver)}{" "}
          <span className="num">{Math.round(records.topSpeed.kph)} kph</span>
        </>
      ) : "—",
      note: records.topSpeed ? String(records.topSpeed.season) : undefined,
    },
    {
      label: "Most wins",
      value: records.mostWins.length ? (
        <>
          {records.mostWins.map((w, i) => (
            <span key={w.driver}>
              {i > 0 && <span style={{ color: "var(--ink-faint)" }}>, </span>}
              {driverLink(w.driver)}
            </span>
          ))}{" "}
          <span className="num">×{records.mostWins[0].count}</span>
        </>
      ) : "—",
    },
    {
      label: "Most poles",
      value: records.mostPoles.length ? (
        <>
          {records.mostPoles.map((w, i) => (
            <span key={w.driver}>
              {i > 0 && <span style={{ color: "var(--ink-faint)" }}>, </span>}
              {driverLink(w.driver)}
            </span>
          ))}{" "}
          <span className="num">×{records.mostPoles[0].count}</span>
        </>
      ) : "—",
    },
    {
      label: "Largest winning margin",
      value: records.largestMargin ? (
        <>
          {driverLink(records.largestMargin.driver)}{" "}
          <span className="num">{records.largestMargin.seconds.toFixed(3)}s</span>
        </>
      ) : "—",
      note: records.largestMargin ? String(records.largestMargin.season) : undefined,
    },
    {
      label: "Closest finish",
      value: records.closestMargin ? (
        <>
          {driverLink(records.closestMargin.driver)}{" "}
          <span className="num">{records.closestMargin.seconds.toFixed(3)}s</span>
        </>
      ) : "—",
      note: records.closestMargin ? String(records.closestMargin.season) : undefined,
    },
    {
      label: "Most attrition",
      value: records.highestAttrition ? (
        <span className="num">
          {records.highestAttrition.entries - records.highestAttrition.finishers} retired
        </span>
      ) : "—",
      note: records.highestAttrition
        ? `${records.highestAttrition.season}, ${records.highestAttrition.finishers} of ${records.highestAttrition.entries} classified`
        : undefined,
    },
  ];

  return (
    <section className="mb-6 card" style={{ padding: "var(--space-4)" }}>
      <SectionHeading
        label="RECORDS"
        title={`Best of ${window}`}
        note={
          <>
            Within the seasons this site holds, not all-time — most of these circuits have
            been raced for decades, and a lap record set before {window} is simply not in
            the data. Race laps exclude in-laps, out-laps and anything run behind the
            safety car. A winning margin exists only where the runner-up finished on the
            lead lap.
          </>
        }
      />

      <dl className="grid-2up" style={{ gap: 1, background: "var(--border-faint)" }}>
        {entries.map((e) => (
          <div
            key={e.label}
            style={{ background: "var(--surface)", padding: "9px 11px" }}
          >
            <dt className="label" style={{ color: "var(--ink-faint)" }}>{e.label}</dt>
            <dd style={{ marginTop: 3 }}>
              {e.value}
              {e.note && (
                <span className="num" style={{ color: "var(--ink-faint)", marginLeft: 7 }}>
                  {e.note}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {leaders.length > 0 && (
        <div className="mt-4">
          <p className="label" style={{ color: "var(--ink-faint)" }}>
            MOST POINTS HERE
          </p>
          <ol className="mt-1" style={{ listStyle: "none", display: "grid", gap: 1 }}>
            {leaders.map((l, i) => (
              <li key={l.driver}>
                <Link
                  href={`/driver/${l.driver}`}
                  className="row-link"
                  style={{ gap: "var(--space-3)", padding: "4px 6px" }}
                >
                  <span className="num" style={{ width: 16, color: "var(--ink-faint)" }}>{i + 1}</span>
                  <span className="num" style={{ width: 42, fontWeight: 650 }}>{l.driver}</span>
                  <span className="num" style={{ color: "var(--ink-faint)", flex: 1 }}>
                    {l.starts} start{l.starts === 1 ? "" : "s"}
                    {l.best !== null && `, best P${l.best}`}
                  </span>
                  <span className="num" style={{ fontWeight: 650 }}>{l.points}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
