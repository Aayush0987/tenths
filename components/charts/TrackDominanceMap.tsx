import type { TelemetryData } from "@/types/data";
import type { SectorVerdict } from "@/lib/analysis/lapCompare";
import { SERIES_COLORS } from "@/lib/charts/palette";

interface Props {
  telemetry: TelemetryData;
  sectors: SectorVerdict[];
  codeA: string;
  codeB: string;
}

/**
 * The circuit, drawn from real position telemetry, with each mini-sector
 * coloured by which of two drivers was quicker through it.
 *
 * Two drivers rather than the whole field, deliberately. Across twenty cars
 * the difference through a single mini-sector is usually within noise and the
 * "winner" flips on nothing — an earlier attempt produced eleven different
 * winners across twenty-five sectors, which is a picture of sampling error.
 * Between two laps the comparison is real.
 *
 * Plain SVG, server-rendered: it is a shape, not a plot, and needs no
 * JavaScript to be useful.
 */
export default function TrackDominanceMap({ telemetry, sectors, codeA, codeB }: Props) {
  const pts = telemetry.path.filter(
    (p): p is { x: number; y: number; miniSector: number } => p.x !== null && p.y !== null,
  );
  if (pts.length < 10) return null;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(maxX - minX, maxY - minY) * 0.05;

  const verdict = new Map(sectors.map((s) => [s.miniSector, s]));

  // One polyline per mini-sector, each starting at the previous sector's last
  // point so the track reads as continuous rather than dashed.
  const runs: { sector: number; points: typeof pts }[] = [];
  for (const p of pts) {
    const last = runs[runs.length - 1];
    if (!last || last.sector !== p.miniSector) {
      const run = { sector: p.miniSector, points: [] as typeof pts };
      if (last) run.points.push(last.points[last.points.length - 1]);
      run.points.push(p);
      runs.push(run);
    } else {
      last.points.push(p);
    }
  }

  const colourFor = (sector: number) => {
    const v = verdict.get(sector);
    if (!v || v.winner === null) return "var(--ink-faint)";
    return v.winner === "a" ? SERIES_COLORS[0] : SERIES_COLORS[1];
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-2">
        {[[codeA, SERIES_COLORS[0]], [codeB, SERIES_COLORS[1]]].map(([code, colour]) => {
          const won = sectors.filter((s) => (s.winner === "a") === (code === codeA) && s.winner !== null).length;
          return (
            <span key={code} className="flex items-center gap-1.5">
              <span aria-hidden="true" style={{ width: 8, height: 8, background: colour, display: "inline-block" }} />
              <span className="label">{code}</span>
              <span className="num" style={{ fontSize: "var(--text-micro)", color: "var(--ink-faint)" }}>
                {won}/{sectors.length}
              </span>
            </span>
          );
        })}
      </div>

      <svg
        viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
        style={{ width: "100%", maxHeight: 420, display: "block" }}
        role="img"
        aria-label={`Circuit map with each mini-sector coloured by whether ${codeA} or ${codeB} was quicker through it`}
      >
        {/* The track under the colour, so unresolved sectors still read as road. */}
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--border)"
          strokeWidth={(maxX - minX) * 0.022}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {runs.map((run, i) => (
          <polyline
            key={i}
            points={run.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={colourFor(run.sector)}
            strokeWidth={(maxX - minX) * 0.014}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>
              Mini-sector {run.sector + 1}: {verdict.get(run.sector)?.winner === "a" ? codeA
                : verdict.get(run.sector)?.winner === "b" ? codeB : "no data"}
              {verdict.get(run.sector)?.gain ? ` by ${verdict.get(run.sector)!.gain.toFixed(3)}s` : ""}
            </title>
          </polyline>
        ))}
      </svg>
    </div>
  );
}
