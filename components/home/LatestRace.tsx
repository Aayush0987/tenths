import Link from "next/link";

import { cleanLapsFor } from "@/lib/analysis/selectors";
import { FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";
import { formatLap } from "@/lib/format";
import { bestQualifyingSeconds } from "@/lib/analysis/championship";
import type { RaceData } from "@/types/data";

/**
 * The most recent race, with enough of the result to be worth reading.
 *
 * A landing page that says only "the last race was at Monza" is a link
 * wearing a headline. This shows the podium, who started from pole and the
 * fastest lap of the race, which is the shape of a grand prix in five
 * figures.
 */
export default function LatestRace({ race }: { race: RaceData }) {
  const teamOf = new Map(race.drivers.map((d) => [d.code, d]));

  const podium = race.results
    .filter((r) => r.position !== null && r.position <= 3)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const pole = race.qualifying.find((q) => q.position === 1);
  const poleSeconds = pole ? bestQualifyingSeconds(pole)?.seconds ?? null : null;

  let fastest: { driver: string; seconds: number } | null = null;
  for (const driver of race.drivers) {
    const laps = race.laps.filter((l) => l.driver === driver.code);
    const stints = race.stints.filter((s) => s.driver === driver.code);
    for (const lap of cleanLapsFor(laps, stints)) {
      if (fastest === null || lap.seconds < fastest.seconds) {
        fastest = { driver: driver.code, seconds: lap.seconds };
      }
    }
  }

  const winner = podium[0];
  const runnerUp = podium[1];
  const margin =
    winner && runnerUp && runnerUp.gapSeconds !== null ? runnerUp.gapSeconds : null;

  return (
    <section className="card" style={{ padding: "var(--space-4)" }}>
      <p className="label">LATEST RACE</p>

      <h2 style={{ fontSize: "var(--text-title)", fontWeight: 650, marginTop: 2 }}>
        <Link href={`/${race.season}/${race.round}`} style={{ color: "inherit", textDecoration: "none" }}>
          {race.raceName}
        </Link>
      </h2>

      <p className="num" style={{ fontSize: "var(--text-small)", color: "var(--ink-muted)", marginTop: 4 }}>
        {race.season} · ROUND {race.round} · {race.location.toUpperCase()} · {race.date}
      </p>

      <ol
        className="mt-4"
        style={{ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}
      >
        {podium.map((r) => {
          const info = teamOf.get(r.driver);
          return (
            <li key={r.driver} style={{ background: "var(--surface-sunken)", padding: "10px 12px" }}>
              <div className="flex items-baseline gap-2">
                <span className="num" style={{ fontSize: "var(--text-small)", color: "var(--ink-faint)" }}>
                  P{r.position}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 3, height: 12, display: "inline-block",
                    background: info?.teamColor ?? FALLBACK_TEAM_COLOR,
                  }}
                />
              </div>
              <p className="num" style={{ fontSize: "var(--text-title)", fontWeight: 700, marginTop: 2 }}>
                {r.driver}
              </p>
              <p
                style={{
                  fontSize: "var(--text-small)", color: "var(--ink-muted)", marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
                title={info?.team ?? ""}
              >
                {info?.team ?? ""}
              </p>
            </li>
          );
        })}
      </ol>

      <dl className="mt-3 flex flex-wrap" style={{ gap: "var(--space-5)" }}>
        {[
          {
            label: "POLE",
            value: pole?.driver ?? "—",
            detail: poleSeconds !== null ? formatLap(poleSeconds) : null,
          },
          {
            label: "FASTEST LAP",
            value: fastest?.driver ?? "—",
            detail: fastest ? formatLap(fastest.seconds) : null,
          },
          {
            label: "WINNING MARGIN",
            value: margin !== null ? `${margin.toFixed(3)}s` : "—",
            detail: null,
          },
          { label: "LAPS", value: String(race.totalLaps), detail: null },
        ].map((item) => (
          <div key={item.label}>
            <dt className="label" style={{ color: "var(--ink-faint)" }}>{item.label}</dt>
            <dd className="num" style={{ fontWeight: 650, marginTop: 2 }}>
              {item.value}
              {item.detail && (
                <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}> {item.detail}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
