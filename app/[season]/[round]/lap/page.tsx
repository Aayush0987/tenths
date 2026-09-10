import Link from "next/link";
import { notFound } from "next/navigation";
import { getRace, getTelemetry } from "@/lib/data/read";
import { compareLaps } from "@/lib/analysis/lapCompare";
import SectionHeading from "@/components/ui/SectionHeading";
import TrackDominanceMap from "@/components/charts/TrackDominanceMap";
import LapTraceCharts from "@/components/charts/LapTraceCharts";
import { SERIES_COLORS } from "@/lib/charts/palette";
import { formatLap } from "@/lib/format";

/**
 * The lap explorer: two qualifying laps compared.
 *
 * Which two is in the URL rather than in client state, so the server sends
 * only the two traces being looked at instead of all twenty, and a comparison
 * can be linked to.
 */
export default async function LapPage({
  params,
  searchParams,
}: {
  params: Promise<{ season: string; round: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { season, round } = await params;
  const { a, b } = await searchParams;
  const seasonNo = Number(season);

  const [race, telemetry] = await Promise.all([
    getRace(seasonNo, round),
    getTelemetry(seasonNo, round),
  ]);
  if (!race) notFound();

  const backHref = `/${seasonNo}/${round}`;

  if (!telemetry) {
    return (
      <div className="px-4 py-5">
        <Link href={backHref} className="label" style={{ textDecoration: "none" }}>← {race.raceName}</Link>
        <div className="mt-4">
          <SectionHeading
            label="LAP EXPLORER"
            title="No telemetry for this season"
            note="Position and car telemetry are published from 2018 onwards but not for 2026, so the track map and traces are unavailable here. Everything else on the race page is unaffected."
          />
        </div>
      </div>
    );
  }

  // Ordered by lap time, so the default pairing is the two quickest.
  const byPace = [...telemetry.traces]
    .filter((t) => t.lapSeconds !== null)
    .sort((x, y) => (x.lapSeconds as number) - (y.lapSeconds as number));

  const codeA = byPace.find((t) => t.driver === a)?.driver ?? byPace[0]?.driver;
  const codeB = byPace.find((t) => t.driver === b && t.driver !== codeA)?.driver
    ?? byPace.find((t) => t.driver !== codeA)?.driver;
  if (!codeA || !codeB) notFound();

  const traceA = telemetry.traces.find((t) => t.driver === codeA)!;
  const traceB = telemetry.traces.find((t) => t.driver === codeB)!;
  const comparison = compareLaps(traceA, traceB, telemetry.miniSectors);

  const wonA = comparison.sectors.filter((s) => s.winner === "a").length;
  const wonB = comparison.sectors.filter((s) => s.winner === "b").length;

  function Picker({ slot, current }: { slot: "a" | "b"; current: string }) {
    return (
      <div className="flex flex-wrap gap-1">
        {byPace.map((t) => {
          const selected = t.driver === current;
          const href = slot === "a"
            ? `${backHref}/lap?a=${t.driver}&b=${codeB}`
            : `${backHref}/lap?a=${codeA}&b=${t.driver}`;
          return (
            <Link
              key={t.driver}
              href={href}
              className="label"
              style={{
                textDecoration: "none",
                padding: "2px 5px",
                border: `1px solid ${selected ? "var(--accent)" : "var(--border-faint)"}`,
                color: selected ? "var(--accent)" : "var(--ink-muted)",
                background: selected ? "var(--surface-hover)" : "transparent",
              }}
            >
              {t.driver}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-4 py-5">
      <Link href={backHref} className="label" style={{ textDecoration: "none" }}>← {race.raceName}</Link>

      <div className="mt-3">
        <SectionHeading
          label={`LAP EXPLORER · ROUND ${race.round}`}
          title={`${codeA} vs ${codeB}`}
          note={`Fastest qualifying lap each. ${codeA} ${formatLap(comparison.lapA ?? 0)}, ${codeB} ${formatLap(comparison.lapB ?? 0)} — ${wonA} mini-sectors to ${wonB}. Qualifying rather than the race, because there the whole field attacks the same lap on low fuel and new tyres.`}
        />
      </div>

      <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {([["a", codeA], ["b", codeB]] as const).map(([slot, code], i) => (
          <div key={slot}>
            <p className="label" style={{ color: SERIES_COLORS[i], marginBottom: 4 }}>
              {slot === "a" ? "REFERENCE" : "COMPARE"} · {code}
            </p>
            <Picker slot={slot} current={code} />
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(280px, 460px) 1fr" }}>
        <div style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }} className="p-3">
          <p className="label" style={{ marginBottom: 6 }}>TRACK DOMINANCE</p>
          <TrackDominanceMap telemetry={telemetry} sectors={comparison.sectors} codeA={codeA} codeB={codeB} />
        </div>

        <div style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }} className="p-3">
          <p className="label" style={{ marginBottom: 6 }}>
            SPEED, AND WHERE THE TIME GOES
          </p>
          <div style={{ overflowX: "auto" }}>
            <LapTraceCharts points={comparison.points} codeA={codeA} codeB={codeB} />
          </div>
          <p style={{ fontSize: "var(--text-micro)", color: "var(--ink-faint)", marginTop: 6, lineHeight: 1.5 }}>
            Delta is a difference of lap-relative times, so it does not drift across the lap.
            Above the line means {codeB} is behind.
          </p>
        </div>
      </div>
    </div>
  );
}
