import Link from "next/link";

import SectionHeading from "@/components/ui/SectionHeading";
import { buildStandings } from "@/lib/analysis/championship";
import { SEASONS, getAllRaces, getCircuits, getDrivers, getSeasonRaces } from "@/lib/data/aggregate";

export default async function Home() {
  const races = await getAllRaces();
  const drivers = await getDrivers();
  const circuits = await getCircuits();

  const latest = [...races].sort(
    (a, b) => b.season - a.season || b.round - a.round,
  )[0];

  // Every figure here is counted from what is actually on disk. A home page
  // that advertises seasons the repository does not hold is the first thing a
  // reader can catch out.
  const seasonsHeld = [...new Set(races.map((r) => r.season))].sort((a, b) => b - a);

  const standings = latest ? buildStandings(await getSeasonRaces(latest.season)) : null;
  const leader = standings?.drivers[0];

  const rows: [string, string][] = [
    ["SEASONS", seasonsHeld.join(", ")],
    ["RACES", String(races.length)],
    ["DRIVERS", String(drivers.length)],
    ["CIRCUITS", String(circuits.length)],
    ["DATA", "precomputed, committed"],
  ];

  return (
    <div className="px-4 py-6">
      <p className="label">F1 RACE ANALYSIS</p>
      <h1
        style={{
          fontSize: "var(--text-display)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginTop: 4,
          marginBottom: 6,
        }}
      >
        Tenths
      </h1>
      <p style={{ color: "var(--ink-muted)", maxWidth: 580, lineHeight: 1.55 }}>
        What happened in a race, and why. Tyre degradation, where a lap was lost, when
        the race was neutralised — and how any of it compares across seasons.
      </p>

      <dl
        className="mt-6 inline-grid"
        style={{
          gridTemplateColumns: "auto auto",
          gap: "0 var(--space-5)",
          border: "1px solid var(--border-faint)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--surface-sunken)",
        }}
      >
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="label" style={{ paddingTop: 4, paddingBottom: 4 }}>{k}</dt>
            <dd className="num" style={{ paddingTop: 4, paddingBottom: 4, textAlign: "right" }}>{v}</dd>
          </div>
        ))}
      </dl>

      {latest && (
        <div className="mt-7">
          <SectionHeading
            label="LATEST"
            title={
              <Link href={`/${latest.season}/${latest.round}`} style={{ color: "inherit" }}>
                {latest.raceName}
              </Link>
            }
            note={
              <>
                Round {latest.round} of {latest.season} · {latest.location} · {latest.date}
                {leader && (
                  <>
                    {" "}· {leader.code} leads the championship on {leader.points} points.
                  </>
                )}
              </>
            }
          />
        </div>
      )}

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Seasons">
        {SEASONS.filter((s) => seasonsHeld.includes(s)).map((season) => (
          <Link
            key={season}
            href={`/${season}`}
            className="num"
            style={{
              border: "1px solid var(--border)",
              padding: "5px 12px",
              textDecoration: "none",
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            {season}
          </Link>
        ))}
      </nav>

      <p className="mt-6" style={{ fontSize: "var(--text-small)", color: "var(--ink-faint)", maxWidth: 580 }}>
        Qualifying telemetry — track maps, speed traces and lap deltas — is published
        through 2025; 2026 has none, and those views say so rather than rendering
        empty.
      </p>
    </div>
  );
}
