"use client";

import Link from "next/link";
import { useState } from "react";

import { FALLBACK_TEAM_COLOR } from "@/lib/charts/palette";

export interface SnapshotDriver {
  code: string;
  name: string;
  team: string;
  teamColor: string | null;
  points: number;
  wins: number;
}

export interface SnapshotSeason {
  season: number;
  rounds: number;
  complete: boolean;
  drivers: SnapshotDriver[];
}

/**
 * The championship as it stands, with a season toggle.
 *
 * Bars are scaled against the leader rather than against a fixed maximum, so
 * the shape of a runaway year and a close one are both legible. They are drawn
 * in team colour, which is an affordance and not the encoding — the driver
 * code and the figure are printed on every row, so nothing here depends on
 * telling two blues apart.
 */
export default function ChampionshipSnapshot({ seasons }: { seasons: SnapshotSeason[] }) {
  const [active, setActive] = useState(seasons[0]?.season);
  const current = seasons.find((s) => s.season === active) ?? seasons[0];
  if (!current) return null;

  const leader = current.drivers[0];
  const max = Math.max(1, leader?.points ?? 1);

  return (
    <section className="card" style={{ padding: "var(--space-4)" }}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <p className="label">CHAMPIONSHIP</p>
          <h2 style={{ fontSize: "var(--text-title)", fontWeight: 650, marginTop: 2 }}>
            {current.complete ? `${current.season} final` : "As it stands"}
          </h2>
        </div>

        <div role="group" aria-label="Season" className="flex" style={{ gap: 1 }}>
          {seasons.map((s) => {
            const selected = s.season === current.season;
            return (
              <button
                key={s.season}
                type="button"
                onClick={() => setActive(s.season)}
                aria-pressed={selected}
                className="num"
                style={{
                  padding: "4px 10px",
                  fontSize: "var(--text-small)",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  background: selected ? "var(--accent)" : "transparent",
                  color: selected ? "var(--on-accent)" : "var(--ink-muted)",
                  transition: "border-color 120ms ease, background-color 120ms ease",
                }}
              >
                {s.season}
              </button>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: "var(--text-small)", color: "var(--ink-muted)", marginBottom: 12 }}>
        {current.complete
          ? `Final standings after ${current.rounds} rounds.`
          : `After ${current.rounds} of the rounds run so far.`}{" "}
        Points include sprints.
      </p>

      <ol style={{ listStyle: "none", display: "grid", gap: 1 }}>
        {current.drivers.map((d, i) => {
          const width = `${Math.max(2, (d.points / max) * 100)}%`;
          return (
            <li key={d.code}>
              <Link
                href={`/driver/${d.code}`}
                className="row-link"
                style={{ gap: "var(--space-3)", padding: "5px 6px" }}
              >
                <span
                  className="num"
                  style={{ width: 18, color: "var(--ink-faint)", fontSize: "var(--text-small)" }}
                >
                  {i + 1}
                </span>
                <span className="num" style={{ width: 40, fontWeight: 650 }}>
                  {d.code}
                </span>

                {/* The bar and the figure share a row so the eye can compare
                    lengths down the column and still read exact values. */}
                <span
                  style={{
                    flex: 1, height: 14, minWidth: 60,
                    background: "var(--surface-sunken)", position: "relative",
                  }}
                  aria-hidden="true"
                >
                  <span
                    style={{
                      display: "block", height: "100%", width,
                      background: d.teamColor ?? FALLBACK_TEAM_COLOR,
                    }}
                  />
                </span>

                <span
                  className="num"
                  style={{ width: 46, textAlign: "right", fontWeight: 650 }}
                >
                  {d.points}
                </span>
                <span
                  className="num"
                  style={{
                    width: 34, textAlign: "right", fontSize: "var(--text-small)",
                    color: d.wins > 0 ? "var(--ink-muted)" : "var(--ink-faint)",
                  }}
                  title={`${d.wins} win${d.wins === 1 ? "" : "s"}`}
                >
                  {d.wins}W
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <Link
        href={`/${current.season}`}
        className="label mt-3 inline-block"
        style={{ color: "var(--accent)", textDecoration: "none" }}
      >
        FULL {current.season} SEASON →
      </Link>
    </section>
  );
}
