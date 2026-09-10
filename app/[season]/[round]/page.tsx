import Link from "next/link";
import { notFound } from "next/navigation";
import { getRace, getSeasonIndex, getTelemetry } from "@/lib/data/read";
import type { RaceData } from "@/types/data";
import SectionHeading from "@/components/ui/SectionHeading";
import TyreStrategyChart from "@/components/charts/TyreStrategyChart";
import DegradationChart from "@/components/charts/DegradationChart";
import GapToLeaderChart from "@/components/charts/GapToLeaderChart";
import ConsistencyChart from "@/components/charts/ConsistencyChart";
import PositionChart from "@/components/charts/PositionChart";
import SectorChart from "@/components/charts/SectorChart";
import SpeedTrapChart from "@/components/charts/SpeedTrapChart";
import RaceControlTimeline from "@/components/charts/RaceControlTimeline";
import WeatherChart from "@/components/charts/WeatherChart";
import QualifyingGapChart from "@/components/charts/QualifyingGapChart";
import RaceReplay from "@/components/charts/RaceReplay";
import StartChart from "@/components/charts/StartChart";
import CutlineChart from "@/components/charts/CutlineChart";
import { buildReplay } from "@/lib/analysis/replay";
import { startPerformance } from "@/lib/analysis/start";
import { buildCutline } from "@/lib/analysis/cutline";
import { circuitGeometry } from "@/lib/analysis/circuit";

/**
 * Finishing order.
 *
 * Taken from the classification the results feed publishes, which is
 * authoritative. It used to be reconstructed from each driver's last recorded
 * lap position, because FastF1 sourced results from Ergast and Ergast returned
 * nothing — that reconstruction agreed with the classification for anyone who
 * saw the flag but had to guess at the order of retirements. The pipeline now
 * carries real results, so the guess is gone.
 *
 * The old reconstruction is kept as a fallback for any file written before
 * results were exported.
 */
function finishingOrder(race: RaceData): string[] {
  if (race.results.length > 0) {
    return [...race.results]
      .sort((a, b) => {
        if (a.position === null && b.position === null) return 0;
        if (a.position === null) return 1;
        if (b.position === null) return -1;
        return a.position - b.position;
      })
      .map((r) => r.driver);
  }

  const last = new Map<string, { lap: number; position: number }>();
  for (const l of race.laps) {
    if (l.position === null) continue;
    const prev = last.get(l.driver);
    if (!prev || l.lap > prev.lap) last.set(l.driver, { lap: l.lap, position: l.position });
  }
  const finalLap = Math.max(0, ...[...last.values()].map((v) => v.lap));
  return [...last.entries()]
    .sort((a, b) => {
      const aOut = a[1].lap < finalLap;
      const bOut = b[1].lap < finalLap;
      if (aOut !== bOut) return aOut ? 1 : -1;
      if (aOut && bOut) return b[1].lap - a[1].lap;
      return a[1].position - b[1].position;
    })
    .map(([driver]) => driver);
}

export default async function RacePage({
  params,
}: {
  params: Promise<{ season: string; round: string }>;
}) {
  const { season, round } = await params;
  const seasonNo = Number(season);
  const [race, telemetry, index] = await Promise.all([
    getRace(seasonNo, round),
    getTelemetry(seasonNo, round),
    getSeasonIndex(seasonNo),
  ]);
  if (!race) notFound();

  const order = finishingOrder(race);
  const rounds = index?.races.map((r) => r.round) ?? [];
  const at = rounds.indexOf(race.round);
  const prev = at > 0 ? rounds[at - 1] : null;
  const next = at >= 0 && at < rounds.length - 1 ? rounds[at + 1] : null;

  const replay = race.laps.length > 0 ? buildReplay(race) : null;

  // Only the outline and its extent cross to the client; the braking split the
  // circuit page uses would be a duplicate of the same points.
  const full = telemetry ? circuitGeometry(telemetry) : null;
  const track = full
    ? { points: full.points.map((p) => ({ x: p.x, y: p.y })), bounds: full.bounds }
    : null;
  const starts = race.results.length > 0 ? startPerformance(race) : [];
  const cutline = race.qualifying.length > 0 ? buildCutline(race) : [];

  const facts: [string, string][] = [
    ["LAPS", String(race.totalLaps)],
    ["DRIVERS", String(race.drivers.length)],
    ["DATE", race.date ?? "—"],
    ["TELEMETRY", telemetry ? `${telemetry.traces.length} laps` : "not published"],
  ];

  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/${seasonNo}`} className="label" style={{ textDecoration: "none" }}>
          ← {seasonNo}
        </Link>
        {telemetry && (
          <Link href={`/${seasonNo}/${round}/lap`} className="label" style={{ textDecoration: "none", color: "var(--accent)" }}>
            LAP EXPLORER →
          </Link>
        )}
        <span className="ml-auto flex items-center gap-2">
          {prev && <Link href={`/${seasonNo}/${prev}`} className="label" style={{ textDecoration: "none" }}>← R{prev}</Link>}
          <span className="label num" style={{ color: "var(--accent)" }}>R{race.round}</span>
          {next && <Link href={`/${seasonNo}/${next}`} className="label" style={{ textDecoration: "none" }}>R{next} →</Link>}
        </span>
      </div>

      <SectionHeading
        label={`ROUND ${race.round} · ${race.country.toUpperCase()}`}
        title={race.raceName}
      />

      <dl
        className="mb-6 flex flex-wrap"
        style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}
      >
        {facts.map(([k, v]) => (
          <div key={k} className="px-3 py-2" style={{ borderRight: "1px solid var(--border-faint)", minWidth: 110 }}>
            <dt className="label">{k}</dt>
            <dd className="num" style={{ marginTop: 2 }}>{v}</dd>
          </div>
        ))}
      </dl>

      {replay && (
        <RaceReplay
          wire={replay}
          drivers={race.drivers}
          track={track}
          raceName={race.raceName}
        />
      )}

      {starts.length > 0 && <StartChart rows={starts} />}

      {race.stints.length > 0 && (
        <TyreStrategyChart stints={race.stints} totalLaps={race.totalLaps} driverOrder={order} />
      )}

      {race.laps.length > 0 && (
        <GapToLeaderChart laps={race.laps} drivers={race.drivers} totalLaps={race.totalLaps} />
      )}

      {race.laps.length > 0 && race.stints.length > 0 && (
        <DegradationChart laps={race.laps} stints={race.stints} />
      )}

      {race.laps.length > 0 && race.stints.length > 0 && (
        <ConsistencyChart laps={race.laps} stints={race.stints} />
      )}

      {race.laps.length > 0 && (
        <PositionChart laps={race.laps} drivers={race.drivers} totalLaps={race.totalLaps} driverOrder={order} />
      )}

      {race.sectors.length > 0 && <SectorChart sectors={race.sectors} />}

      {race.sectors.length > 0 && <SpeedTrapChart sectors={race.sectors} />}

      {race.raceControl.length > 0 && (
        <RaceControlTimeline messages={race.raceControl} totalLaps={race.totalLaps} />
      )}

      {race.weather.length > 0 && <WeatherChart weather={race.weather} />}

      {cutline.length > 0 && <CutlineChart segments={cutline} />}

      {race.qualifying.length > 0 && <QualifyingGapChart qualifying={race.qualifying} />}
    </div>
  );
}
