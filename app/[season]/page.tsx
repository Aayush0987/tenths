import Link from "next/link";
import { notFound } from "next/navigation";

import ChampionshipChart from "@/components/charts/ChampionshipChart";
import ResultsGrid from "@/components/charts/ResultsGrid";
import SectionHeading from "@/components/ui/SectionHeading";
import { buildStandings } from "@/lib/analysis/championship";
import { getSeasonRaces, getSeasons } from "@/lib/data/aggregate";
import { getSeasonIndex } from "@/lib/data/read";

export async function generateStaticParams() {
  const seasons = await getSeasons();
  return seasons.map((season) => ({ season: String(season) }));
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number(season);
  const index = await getSeasonIndex(seasonNumber);
  if (!index || index.races.length === 0) notFound();

  const races = await getSeasonRaces(seasonNumber);
  const standings = buildStandings(races);
  const withTelemetry = index.races.filter((r) => r.hasTelemetry).length;

  // Winner per round, so the calendar reads as results rather than as a list
  // of links.
  const byRound = new Map(races.map((r) => [r.round, r]));

  return (
    <div className="px-4 py-5">
      <SectionHeading
        label={`SEASON ${index.season}`}
        title={`${index.races.length} races`}
        note={
          <>
            {withTelemetry === index.races.length
              ? "Telemetry available for every round."
              : withTelemetry === 0
                ? "No telemetry published for this season — track maps and traces are unavailable."
                : `Telemetry available for ${withTelemetry} of ${index.races.length} rounds.`}{" "}
            Points include sprints.
          </>
        }
      />

      {standings.drivers.length > 0 && (
        <>
          <ChampionshipChart standings={standings} season={seasonNumber} />
          <ResultsGrid standings={standings} races={races} season={seasonNumber} />

          <section
            className="mb-6"
            style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}
          >
            <div className="px-3 pt-3">
              <SectionHeading
                label="CONSTRUCTORS"
                title={`${seasonNumber} teams`}
                note="Both cars' points, sprints included."
              />
            </div>
            <div className="px-3 pb-3" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-small)" }}>
                <thead>
                  <tr>
                    {["#", "Team", "Drivers", "Points"].map((c, i) => (
                      <th
                        key={c} scope="col" className="label"
                        style={{ textAlign: i === 3 ? "right" : "left", padding: "5px 8px", fontWeight: 600 }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.constructors.map((t, i) => (
                    <tr key={t.team} style={{ borderTop: "1px solid var(--border-faint)" }}>
                      <td className="num" style={{ padding: "5px 8px", color: "var(--ink-faint)", width: 26 }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: "5px 8px", fontWeight: 600 }}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            style={{
                              width: 3, height: 13,
                              background: t.teamColor ?? "var(--ink-faint)",
                              display: "inline-block",
                            }}
                          />
                          {t.team}
                        </span>
                      </td>
                      <td className="num" style={{ padding: "5px 8px", color: "var(--ink-muted)" }}>
                        {t.drivers.map((code) => (
                          <Link
                            key={code}
                            href={`/driver/${code}`}
                            style={{ color: "inherit", marginRight: 8 }}
                          >
                            {code}
                          </Link>
                        ))}
                      </td>
                      <td className="num" style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>
                        {t.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <SectionHeading label="CALENDAR" title={`${seasonNumber} rounds`} />
      <ul style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
        {index.races.map((race, i) => {
          const full = byRound.get(race.round);
          const winner = full?.results.find((r) => r.position === 1)?.driver;
          return (
            <li key={race.round} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
              <Link
                href={`/${index.season}/${race.round}`}
                className="flex items-center gap-4 px-3 py-2"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className="num" style={{ width: 26, color: "var(--ink-faint)", textAlign: "right" }}>
                  {race.round}
                </span>
                <span style={{ fontWeight: 600, minWidth: 200 }}>
                  {race.raceName.replace(" Grand Prix", "")}
                </span>
                <span className="label" style={{ color: "var(--ink-faint)", minWidth: 110 }}>
                  {race.location}
                </span>
                <span className="num" style={{ width: 44, color: "var(--ink)" }} title="Winner">
                  {winner ?? "—"}
                </span>
                <span className="num ml-auto" style={{ color: "var(--ink-muted)" }}>{race.date}</span>
                <span className="num" style={{ width: 52, textAlign: "right", color: "var(--ink-faint)" }}>
                  {race.totalLaps}L
                </span>
                <span
                  className="label"
                  style={{ width: 28, textAlign: "right", color: race.hasTelemetry ? "var(--accent)" : "var(--ink-faint)" }}
                  title={race.hasTelemetry ? "Telemetry available" : "No telemetry"}
                >
                  {race.hasTelemetry ? "TEL" : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
