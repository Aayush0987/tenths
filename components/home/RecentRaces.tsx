import Link from "next/link";

import { FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";
import type { RaceData } from "@/types/data";

/**
 * The rounds before the latest one.
 *
 * Sits under the latest-race card so the left column carries as much as the
 * standings beside it, and gives the landing page a second way in — most
 * people arrive wanting a specific recent race rather than a season.
 */
export default function RecentRaces({ races }: { races: RaceData[] }) {
  if (races.length === 0) return null;

  return (
    <section className="card" style={{ padding: "var(--space-4) var(--space-4) var(--space-2)" }}>
      <p className="label" style={{ marginBottom: "var(--space-2)" }}>BEFORE THAT</p>

      <ul style={{ listStyle: "none" }}>
        {races.map((race) => {
          const winner = race.results.find((r) => r.position === 1);
          const team = winner ? race.drivers.find((d) => d.code === winner.driver) : undefined;
          return (
            <li key={`${race.season}-${race.round}`}>
              <Link
                href={`/${race.season}/${race.round}`}
                className="row-link"
                style={{ gap: "var(--space-3)", padding: "6px 6px" }}
              >
                <span
                  className="num"
                  style={{ width: 30, color: "var(--ink-faint)", fontSize: "var(--text-small)" }}
                >
                  R{race.round}
                </span>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden",
                               textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {race.raceName.replace(" Grand Prix", "")}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 3, height: 12, display: "inline-block",
                    background: team?.teamColor ?? FALLBACK_TEAM_COLOR,
                  }}
                />
                <span className="num" style={{ width: 38, fontWeight: 650 }}>
                  {winner?.driver ?? "—"}
                </span>
                <span
                  className="num"
                  style={{ width: 78, textAlign: "right", color: "var(--ink-faint)",
                           fontSize: "var(--text-small)" }}
                >
                  {race.date}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
