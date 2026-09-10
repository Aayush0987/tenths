"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { COMPOUND_INITIALS, FALLBACK_TEAM_COLOR, compoundColor, compoundTextColor } from "@/lib/charts/palette";
import { decodeReplay, type ReplayWire } from "@/lib/analysis/replay";

import type { Driver } from "@/types/data";

/** Milliseconds per lap at each speed. */
const SPEEDS = [
  { label: "1×", ms: 900 },
  { label: "2×", ms: 450 },
  { label: "4×", ms: 225 },
];

/**
 * Only what the map needs. The full CircuitGeometry also carries `runs`, which
 * is the same path split by braking — useful for the circuit diagram, seven
 * kilobytes of duplication here, where nothing reads it.
 */
export interface ReplayTrack {
  points: { x: number; y: number }[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

interface Props {
  wire: ReplayWire;
  drivers: Driver[];
  track: ReplayTrack | null;
  raceName: string;
}

/**
 * The race as a scrubbable sequence.
 *
 * Order and gaps are read straight from the data — every lap carries a
 * classified position and the session clock at the line — so the leaderboard
 * is exact at every lap. The dots on the circuit are the one reconstruction,
 * and the caption says so: a car is drawn as far back around the lap as its
 * gap implies at reference pace, which is right at the line and an estimate
 * in between.
 */
export default function RaceReplay({ wire, drivers, track, raceName }: Props) {
  const replay = useMemo(() => decodeReplay(wire), [wire]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<number | null>(null);

  const info = useMemo(
    () => new Map(drivers.map((d) => [d.code, d])),
    [drivers],
  );

  const current = replay.laps[index];

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        if (i >= replay.laps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, SPEEDS[speed].ms);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [playing, speed, replay.laps.length]);

  // Cumulative lengths along the circuit, so a fraction of the lap maps to a
  // point on it. Computed once: the path does not change.
  const path = useMemo(() => {
    if (!track) return null;
    const pts = track.points;
    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      cum.push(cum[i - 1] + Math.hypot(dx, dy));
    }
    return { pts, cum, total: cum[cum.length - 1] };
  }, [track]);

  const pointAt = useCallback(
    (fraction: number) => {
      if (!path || path.total === 0) return null;
      const target = ((fraction % 1) + 1) % 1 * path.total;
      let lo = 0;
      let hi = path.cum.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (path.cum[mid] <= target) lo = mid;
        else hi = mid;
      }
      const span = path.cum[hi] - path.cum[lo] || 1;
      const t = (target - path.cum[lo]) / span;
      return {
        x: path.pts[lo].x + (path.pts[hi].x - path.pts[lo].x) * t,
        y: path.pts[lo].y + (path.pts[hi].y - path.pts[lo].y) * t,
      };
    },
    [path],
  );

  if (!current) return null;

  const dotRadius = track
    ? Math.max(track.bounds.maxX - track.bounds.minX, track.bounds.maxY - track.bounds.minY) * 0.018
    : 0;

  return (
    <section
      className="mb-6"
      style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}
    >
      <div className="px-3 pt-3">
        <p className="label">RACE REPLAY</p>
        <h2 style={{ fontSize: "var(--text-lead)", fontWeight: 650, marginTop: 2 }}>
          Lap {current.lap} of {replay.totalLaps}
        </h2>
        <p
          style={{
            fontSize: "var(--text-small)", color: "var(--ink-muted)",
            marginTop: 6, maxWidth: 760, lineHeight: 1.5,
          }}
        >
          Order and gaps are measured — each lap records a classified position and the
          time the car crossed the line.{" "}
          {track
            ? "Positions around the circuit are reconstructed from those gaps at reference pace: exact at the line, an estimate in between."
            : "This season publishes no telemetry, so there is no circuit to plot against."}
        </p>
      </div>

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-3 px-3 pt-3">
        <button
          type="button"
          onClick={() => {
            if (index >= replay.laps.length - 1) setIndex(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause" : "Play"}
          className="num"
          style={{
            width: 62, padding: "5px 0", cursor: "pointer", fontWeight: 700,
            border: "1px solid var(--accent)", background: "var(--accent)",
            color: "var(--on-accent)", fontSize: "var(--text-small)",
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <input
          type="range"
          min={0}
          max={replay.laps.length - 1}
          value={index}
          onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
          aria-label={`Lap ${current.lap} of ${replay.totalLaps}`}
          style={{ flex: 1, minWidth: 180, accentColor: "var(--accent)" }}
        />

        <div className="flex" style={{ gap: 1 }}>
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSpeed(i)}
              aria-pressed={speed === i}
              className="num"
              style={{
                padding: "4px 9px", cursor: "pointer", fontSize: "var(--text-small)",
                border: "1px solid",
                borderColor: speed === i ? "var(--accent)" : "var(--border)",
                background: speed === i ? "var(--accent)" : "transparent",
                color: speed === i ? "var(--on-accent)" : "var(--ink-muted)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Without a circuit there is no left half, so the order takes the full
          width rather than sitting beside an empty column. */}
      <div
        className={track ? "grid-2up px-3 pb-3 pt-3" : "px-3 pb-3 pt-3"}
        style={{ gap: "var(--space-4)", alignItems: "start" }}
      >
        {track && path ? (
          <svg
            viewBox={`${track.bounds.minX - dotRadius * 3} ${track.bounds.minY - dotRadius * 3} ${
              track.bounds.maxX - track.bounds.minX + dotRadius * 6
            } ${track.bounds.maxY - track.bounds.minY + dotRadius * 6}`}
            style={{ width: "100%", maxHeight: 420, display: "block" }}
            role="img"
            aria-label={`${raceName}: running order on lap ${current.lap}, leader ${current.leader}`}
          >
            <polyline
              points={track.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth={dotRadius * 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Drawn back to front so the leader sits on top of the pack. */}
            {[...current.entries].reverse().map((e) => {
              const p = pointAt(e.trackFraction);
              if (!p) return null;
              const colour = info.get(e.driver)?.teamColor ?? FALLBACK_TEAM_COLOR;
              return (
                <g key={e.driver}>
                  <circle
                    cx={p.x} cy={p.y} r={dotRadius}
                    fill={colour}
                    stroke="var(--surface)"
                    strokeWidth={dotRadius * 0.35}
                  >
                    <title>P{e.position} {e.driver}</title>
                  </circle>
                  {e.position === 1 && (
                    <text
                      x={p.x} y={p.y - dotRadius * 1.6}
                      textAnchor="middle"
                      style={{ fontSize: dotRadius * 2.2, fill: "var(--ink)", fontWeight: 700,
                               paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: dotRadius * 0.5 }}
                    >
                      {e.driver}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ) : null}

        {/* Leaderboard */}
        <ol style={{ listStyle: "none", display: "grid", gap: 1 }}>
          {current.entries.map((e) => {
            const d = info.get(e.driver);
            return (
              <li
                key={e.driver}
                className="flex items-center"
                style={{
                  gap: "var(--space-2)", padding: "3px 6px",
                  background: e.pitting ? "var(--accent-wash)" : "transparent",
                }}
              >
                <span className="num" style={{ width: 20, color: "var(--ink-faint)", fontSize: "var(--text-small)" }}>
                  {e.position}
                </span>
                <span
                  aria-hidden="true"
                  style={{ width: 3, height: 12, background: d?.teamColor ?? FALLBACK_TEAM_COLOR, display: "inline-block" }}
                />
                <span className="num" style={{ width: 38, fontWeight: 650 }}>{e.driver}</span>

                {e.compound && (
                  <span
                    className="num"
                    title={e.compound}
                    style={{
                      width: 15, height: 15, lineHeight: "15px", textAlign: "center",
                      fontSize: 9, fontWeight: 700, borderRadius: "50%",
                      background: compoundColor(e.compound),
                      color: compoundTextColor(e.compound),
                    }}
                  >
                    {COMPOUND_INITIALS[e.compound] ?? "?"}
                  </span>
                )}

                <span
                  className="num ml-auto"
                  style={{ color: e.position === 1 ? "var(--ink)" : "var(--ink-muted)", fontSize: "var(--text-small)" }}
                >
                  {e.position === 1
                    ? "LEADER"
                    : e.gapSeconds === null
                      ? "—"
                      : `+${e.gapSeconds.toFixed(1)}s`}
                </span>

                {e.pitting && (
                  <span className="label" style={{ color: "var(--accent)", width: 24, textAlign: "right" }}>
                    PIT
                  </span>
                )}
              </li>
            );
          })}

          {current.out.length > 0 && (
            <li
              className="flex items-center flex-wrap"
              style={{ gap: "var(--space-2)", padding: "6px", marginTop: 4, borderTop: "1px solid var(--border-faint)" }}
            >
              <span className="label" style={{ color: "var(--ink-faint)" }}>OUT</span>
              {current.out.map((code) => (
                <span key={code} className="num" style={{ color: "var(--ink-faint)", fontSize: "var(--text-small)" }}>
                  {code}
                </span>
              ))}
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}
