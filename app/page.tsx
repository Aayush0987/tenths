import Link from "next/link";

import ChampionshipSnapshot, {
  type SnapshotSeason,
} from "@/components/home/ChampionshipSnapshot";
import LatestRace from "@/components/home/LatestRace";
import RecentRaces from "@/components/home/RecentRaces";
import { buildStandings } from "@/lib/analysis/championship";
import {
  getAllRaces, getCircuits, getDrivers, getSeasonIndex, getSeasonRaces,
} from "@/lib/data/aggregate";

const SNAPSHOT_ROWS = 8;

export default async function Home() {
  const races = await getAllRaces();
  const drivers = await getDrivers();
  const circuits = await getCircuits();

  const byRecency = [...races].sort((a, b) => b.season - a.season || b.round - a.round);
  const latest = byRecency[0];
  const recent = byRecency.slice(1, 7);
  const seasonsHeld = [...new Set(races.map((r) => r.season))].sort((a, b) => b - a);

  // Everything counted from what is on disk. A landing page that advertises
  // seasons the repository does not hold is the first thing a reader catches.
  const snapshots: SnapshotSeason[] = [];
  const seasonCards: {
    season: number;
    rounds: number;
    scheduled: number | null;
    champion: string | null;
    championName: string | null;
    championPoints: number | null;
    complete: boolean;
  }[] = [];

  for (const season of seasonsHeld) {
    const seasonRaces = await getSeasonRaces(season);
    if (seasonRaces.length === 0) continue;
    const standings = buildStandings(seasonRaces);
    const index = await getSeasonIndex(season);

    // A season is complete when every round on its calendar has been run.
    // 2026 is mid-flight, and calling its leader a champion would be wrong.
    const scheduled = index?.scheduledRounds ?? null;
    const complete = scheduled !== null ? seasonRaces.length >= scheduled : false;

    snapshots.push({
      season,
      rounds: seasonRaces.length,
      complete,
      drivers: standings.drivers.slice(0, SNAPSHOT_ROWS).map((d) => ({
        code: d.code, name: d.name, team: d.team, teamColor: d.teamColor,
        points: d.points, wins: d.wins,
      })),
    });

    const top = standings.drivers[0];
    seasonCards.push({
      season, rounds: seasonRaces.length, scheduled, complete,
      champion: top?.code ?? null,
      championName: top?.name ?? null,
      championPoints: top?.points ?? null,
    });
  }

  const stats = [
    { figure: String(races.length), label: "RACES" },
    { figure: String(seasonsHeld.length), label: "SEASONS" },
    { figure: String(drivers.length), label: "DRIVERS" },
    { figure: String(circuits.length), label: "CIRCUITS" },
    { figure: "13", label: "ANALYSES PER RACE" },
  ];

  return (
    <div style={{ padding: "var(--space-6) var(--space-4) var(--space-8)" }}>
      {/* ---- Masthead ---------------------------------------------------- */}
      <section style={{ maxWidth: 1500, margin: "0 auto" }}>
        <p className="label">F1 RACE ANALYSIS · {seasonsHeld[seasonsHeld.length - 1]}–{seasonsHeld[0]}</p>

        {/* The wordmark and the sentence explaining it sit on one line at
            width, so the masthead is a band rather than a tall column with an
            empty half beside it. They stack below ~900px. */}
        <div className="grid-masthead" style={{ marginTop: "var(--space-2)" }}>
          <h1
            style={{
              fontSize: "var(--text-hero)",
              fontWeight: 700,
              letterSpacing: "-0.045em",
              lineHeight: 0.86,
            }}
          >
            Tenths
          </h1>

          <p
            style={{
              fontSize: "var(--text-intro)",
              color: "var(--ink-muted)",
              maxWidth: "54ch",
              lineHeight: 1.55,
              paddingBottom: "0.4em",
            }}
          >
            What happened in a race, and why. Tyre degradation, where a lap was lost, when
            the race was neutralised — read off the timing data itself, and compared across
            every season on file.
          </p>
        </div>

        {/* Figures, not a bulleted list: the numbers are the claim. */}
        <dl
          className="mt-7 grid-stats"
          style={{
            gap: 1,
            background: "var(--border-faint)",
            border: "1px solid var(--border-faint)",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ background: "var(--bg)", padding: "var(--space-4)" }}>
              <dd
                className="num"
                style={{
                  fontSize: "var(--text-figure)", fontWeight: 700,
                  letterSpacing: "-0.03em", lineHeight: 1,
                }}
              >
                {s.figure}
              </dd>
              <dt className="label" style={{ marginTop: 6, color: "var(--ink-faint)" }}>
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </section>

      {/* ---- Latest race and championship -------------------------------- */}
      <section
        className="mt-6 grid-2up"
        style={{
          maxWidth: 1500, margin: "var(--space-6) auto 0",
          gap: "var(--space-4)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-3)", alignContent: "start" }}>
          {latest && <LatestRace race={latest} />}
          <RecentRaces races={recent} />
        </div>
        {snapshots.length > 0 && <ChampionshipSnapshot seasons={snapshots} />}
      </section>

      {/* ---- Seasons ------------------------------------------------------ */}
      <section style={{ maxWidth: 1500, margin: "var(--space-7) auto 0" }}>
        <h2 className="label" style={{ marginBottom: "var(--space-3)" }}>SEASONS</h2>
        <div
          className="grid-3up"
          style={{ gap: "var(--space-3)" }}
        >
          {seasonCards.map((s) => (
            <Link key={s.season} href={`/${s.season}`} className="card" style={{ padding: "var(--space-4)" }}>
              <div className="flex items-baseline justify-between">
                <span
                  className="num"
                  style={{
                    fontSize: "var(--text-display)", fontWeight: 700,
                    letterSpacing: "-0.03em", lineHeight: 1,
                  }}
                >
                  {s.season}
                </span>
                <span className="label" style={{ color: s.complete ? "var(--ink-faint)" : "var(--accent)" }}>
                  {s.complete ? "COMPLETE" : "IN PROGRESS"}
                </span>
              </div>

              <p className="num" style={{ fontSize: "var(--text-small)", color: "var(--ink-muted)", marginTop: 8 }}>
                {s.rounds}
                {s.scheduled !== null && !s.complete ? ` / ${s.scheduled}` : ""} ROUNDS
              </p>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}>
                <p className="label" style={{ color: "var(--ink-faint)" }}>
                  {s.complete ? "CHAMPION" : "LEADING"}
                </p>
                <p style={{ marginTop: 3 }}>
                  <span className="num" style={{ fontWeight: 700 }}>{s.champion ?? "—"}</span>
                  <span style={{ color: "var(--ink-muted)" }}> {s.championName ?? ""}</span>
                  <span className="num" style={{ color: "var(--ink-faint)" }}>
                    {s.championPoints !== null ? ` · ${s.championPoints}` : ""}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Browse ------------------------------------------------------- */}
      <section
        className="grid-2up"
        style={{ maxWidth: 1500, margin: "var(--space-4) auto 0", gap: "var(--space-3)" }}
      >
        {[
          {
            href: "/drivers",
            title: "Drivers",
            figure: String(drivers.length),
            note: "Every driver who started a race, with grid-versus-finish and teammate head-to-head.",
          },
          {
            href: "/circuits",
            title: "Circuits",
            figure: String(circuits.length),
            note: "Grouped so a track keeps its identity when the race name or the location string changes.",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="card" style={{ padding: "var(--space-4)" }}>
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: "var(--text-title)", fontWeight: 650 }}>{item.title}</span>
              <span
                className="num"
                style={{ fontSize: "var(--text-display)", fontWeight: 700, letterSpacing: "-0.03em" }}
              >
                {item.figure}
              </span>
            </div>
            <p style={{ fontSize: "var(--text-small)", color: "var(--ink-muted)", marginTop: 6, lineHeight: 1.5 }}>
              {item.note}
            </p>
          </Link>
        ))}
      </section>

      <p
        style={{
          maxWidth: 1500, margin: "var(--space-6) auto 0",
          fontSize: "var(--text-small)", color: "var(--ink-faint)", lineHeight: 1.6,
        }}
      >
        Data is precomputed from FastF1 and committed to the repository, so every page is
        static and nothing is fetched at read time. Qualifying telemetry — track maps,
        speed traces and lap deltas — is published through 2025; 2026 has none, and those
        views say so rather than rendering an empty frame.
      </p>
    </div>
  );
}
