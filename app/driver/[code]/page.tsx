import Link from "next/link";
import { notFound } from "next/navigation";

import DriverSeasonChart from "@/components/charts/DriverSeasonChart";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  buildStandings, racePoints, teammateComparisons,
} from "@/lib/analysis/championship";
import { SEASONS, getAllRaces, getDrivers, getSeasonRaces } from "@/lib/data/aggregate";
import { FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";

export async function generateStaticParams() {
  const drivers = await getDrivers();
  return drivers.map((d) => ({ code: d.code }));
}

interface SeasonLine {
  season: number;
  team: string;
  teamColor: string | null;
  points: number;
  position: number | null;
  starts: number;
  wins: number;
  podiums: number;
  bestFinish: number | null;
}

export default async function DriverPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();

  const drivers = await getDrivers();
  const driver = drivers.find((d) => d.code === code);
  if (!driver) notFound();

  const all = await getAllRaces();
  const mine = all
    .filter((r) => r.drivers.some((d) => d.code === code))
    .sort((a, b) => a.season - b.season || a.round - b.round);

  // Championship position per season has to come from that season's full
  // standings, not from this driver's races alone.
  const seasonLines: SeasonLine[] = [];
  for (const season of [...SEASONS].sort((a, b) => a - b)) {
    const races = await getSeasonRaces(season);
    if (races.length === 0) continue;
    const standings = buildStandings(races);
    const index = standings.drivers.findIndex((d) => d.code === code);
    if (index === -1) continue;
    const row = standings.drivers[index];
    seasonLines.push({
      season, team: row.team, teamColor: row.teamColor, points: row.points,
      position: index + 1, starts: row.starts, wins: row.wins,
      podiums: row.podiums, bestFinish: row.bestFinish,
    });
  }

  const teammates = teammateComparisons(mine, code);
  const totals = seasonLines.reduce(
    (acc, s) => ({
      points: acc.points + s.points, starts: acc.starts + s.starts,
      wins: acc.wins + s.wins, podiums: acc.podiums + s.podiums,
    }),
    { points: 0, starts: 0, wins: 0, podiums: 0 },
  );

  const color = driver.teamColor ?? FALLBACK_TEAM_COLOR;

  return (
    <div className="px-4 py-5">
      <SectionHeading
        label="DRIVER"
        title={
          <span className="flex items-center gap-2.5">
            <span aria-hidden="true" style={{ width: 4, height: 20, background: color, display: "inline-block" }} />
            {driver.name}
            <span className="num" style={{ color: "var(--ink-faint)", fontWeight: 400 }}>{driver.code}</span>
          </span>
        }
        note={
          <>
            {driver.team} · {seasonLines.map((s) => s.season).join(", ")} ·{" "}
            {totals.starts} start{totals.starts === 1 ? "" : "s"} in the data.
            Career figures here cover only the seasons this site holds, not a full career.
          </>
        }
      />

      <dl className="mb-6 flex flex-wrap gap-px" style={{ background: "var(--border-faint)" }}>
        {[
          { label: "Points", value: totals.points },
          { label: "Wins", value: totals.wins },
          { label: "Podiums", value: totals.podiums },
          { label: "Starts", value: totals.starts },
          {
            label: "Best finish",
            value: seasonLines.reduce<number | null>(
              (best, s) => (s.bestFinish === null ? best : best === null ? s.bestFinish : Math.min(best, s.bestFinish)),
              null,
            ) ?? "—",
          },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "var(--surface)", padding: "8px 14px", minWidth: 96, flex: "1 1 auto" }}>
            <dt className="label" style={{ color: "var(--ink-faint)" }}>{stat.label}</dt>
            <dd className="num" style={{ fontSize: "var(--text-lead)", fontWeight: 650, marginTop: 2 }}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <DriverSeasonChart races={mine} code={code} color={color} />

      <section className="mb-6" style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
        <div className="px-3 pt-3">
          <SectionHeading label="BY SEASON" title="Season by season" />
        </div>
        <div className="px-3 pb-3" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-small)" }}>
            <thead>
              <tr>
                {["Season", "Team", "Champ.", "Points", "Starts", "Wins", "Podiums", "Best"].map((c, i) => (
                  <th key={c} scope="col" className="label"
                      style={{ textAlign: i <= 1 ? "left" : "right", padding: "5px 8px", fontWeight: 600 }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...seasonLines].reverse().map((s) => (
                <tr key={s.season} style={{ borderTop: "1px solid var(--border-faint)" }}>
                  <td style={{ padding: "5px 8px", fontWeight: 600 }}>
                    <Link href={`/${s.season}`} style={{ color: "inherit" }}>{s.season}</Link>
                  </td>
                  <td style={{ padding: "5px 8px", color: "var(--ink-muted)" }}>{s.team}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>P{s.position}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{s.points}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>{s.starts}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>{s.wins}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>{s.podiums}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>
                    {s.bestFinish ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {teammates.length > 0 && (
        <section className="mb-6" style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
          <div className="px-3 pt-3">
            <SectionHeading
              label="TEAMMATES"
              title="Head to head"
              note={
                <>
                  Only rounds both drivers contested, and the count is shown beside every
                  tally — mid-season swaps are common and a bare &ldquo;14&ndash;8&rdquo; built on
                  five shared races says nothing. Race results exclude rounds where either
                  driver failed to be classified, since a comparison decided by someone&rsquo;s
                  gearbox is not a comparison of drivers. The qualifying gap is a median,
                  and only over rounds where both set their best lap in the same segment.
                </>
              }
            />
          </div>
          <div className="px-3 pb-3" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-small)" }}>
              <thead>
                <tr>
                  {["Teammate", "Team", "Shared", "Qualifying", "Race", "Median Q gap"].map((c, i) => (
                    <th key={c} scope="col" className="label"
                        style={{ textAlign: i <= 1 ? "left" : "right", padding: "5px 8px", fontWeight: 600 }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teammates.map((t) => {
                  const gap = t.medianQualifyingGap;
                  return (
                    <tr key={`${t.team}-${t.teammate}`} style={{ borderTop: "1px solid var(--border-faint)" }}>
                      <td style={{ padding: "5px 8px", fontWeight: 600 }}>
                        <Link href={`/driver/${t.teammate}`} className="num" style={{ color: "inherit" }}>
                          {t.teammate}
                        </Link>
                      </td>
                      <td style={{ padding: "5px 8px", color: "var(--ink-muted)" }}>{t.team}</td>
                      <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>
                        {t.shared}
                      </td>
                      <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>
                        <strong style={{ color: t.qualifyingWins >= t.qualifyingLosses ? "var(--ink)" : "var(--ink-muted)" }}>
                          {t.qualifyingWins}
                        </strong>
                        <span style={{ color: "var(--ink-faint)" }}>–{t.qualifyingLosses}</span>
                      </td>
                      <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>
                        <strong style={{ color: t.raceWins >= t.raceLosses ? "var(--ink)" : "var(--ink-muted)" }}>
                          {t.raceWins}
                        </strong>
                        <span style={{ color: "var(--ink-faint)" }}>–{t.raceLosses}</span>
                      </td>
                      <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>
                        {gap === null ? "—" : `${gap > 0 ? "+" : ""}${gap.toFixed(3)}s`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SectionHeading label="RACES" title={`${mine.length} rounds`} />
      <ul style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
        {[...mine].reverse().map((race, i) => {
          const result = race.results.find((r) => r.driver === code);
          const grid = result?.grid ?? null;
          const finish = result?.position ?? null;
          const moved = grid !== null && grid > 0 && finish !== null ? grid - finish : null;
          return (
            <li key={`${race.season}-${race.round}`}
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
              <Link href={`/${race.season}/${race.round}`} className="flex items-center gap-4 px-3 py-2"
                    style={{ textDecoration: "none", color: "inherit" }}>
                <span className="num" style={{ width: 38, color: "var(--ink-faint)" }}>{race.season}</span>
                <span className="num" style={{ width: 22, color: "var(--ink-faint)", textAlign: "right" }}>{race.round}</span>
                <span style={{ fontWeight: 600, minWidth: 190 }}>{race.raceName.replace(" Grand Prix", "")}</span>
                <span className="num" style={{ width: 54, color: "var(--ink-muted)" }} title="Grid">
                  {grid === 0 ? "PIT" : grid ?? "—"}
                </span>
                <span className="num" style={{ width: 40, fontWeight: 650 }} title="Finish">
                  {finish ?? (result?.classified === "D" ? "DSQ" : "DNF")}
                </span>
                <span className="num" style={{ width: 48, color: moved && moved > 0 ? "var(--accent)" : "var(--ink-faint)" }}
                      title="Positions gained">
                  {moved === null ? "" : moved > 0 ? `+${moved}` : moved}
                </span>
                <span className="num ml-auto" style={{ color: "var(--ink-muted)" }}>
                  {result ? racePoints(result) : 0} pts
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
