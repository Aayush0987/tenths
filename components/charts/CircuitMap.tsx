import type { CircuitGeometry } from "@/lib/analysis/circuit";

/**
 * The circuit, drawn from the car's own position telemetry.
 *
 * There is no track outline asset anywhere in this project and there does not
 * need to be: the reference qualifying lap records where the car actually was,
 * several hundred times a lap, which is the shape of the circuit. Drawing it
 * from that keeps the diagram consistent with everything else on the page and
 * avoids the licensing that comes attached to published track maps.
 *
 * Braking is the only thing the colour says. A speed ramp was the obvious
 * alternative and was not used: a sequential scale needs validating against
 * both themes before it can be trusted, and it would answer a question the
 * character figures beside this already answer more precisely. Where the car
 * is hard on the brakes is what a diagram can say that a number cannot — it
 * puts the corners in place.
 *
 * Server-rendered SVG. It is a shape, not a plot, and needs no JavaScript.
 */
export default function CircuitMap({
  geometry,
  location,
  height = 300,
}: {
  geometry: CircuitGeometry;
  location: string;
  height?: number;
}) {
  const { bounds, runs, start, heading, direction, brakingZones } = geometry;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  const pad = Math.max(width, depth) * 0.08;

  // Stroke widths are a fraction of the circuit's own extent, so a long track
  // and a tight one both come out looking like roads rather than threads.
  const road = Math.max(width, depth) * 0.017;
  const casing = road * 1.75;

  // The start line spans the track; the arrow sits a little further round so
  // the two marks never sit on top of each other. An earlier version drew both
  // at the first point and they merged into an unreadable smudge — clearest at
  // Suzuka, where the crossover is already busy.
  const tick = road * 1.9;
  const startAngle = ((geometry.start?.angle ?? 0) * Math.PI) / 180;
  const nx = -Math.sin(startAngle) * tick;
  const ny = Math.cos(startAngle) * tick;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${width + pad * 2} ${depth + pad * 2}`}
        style={{ width: "100%", maxHeight: height, display: "block", overflow: "visible" }}
        role="img"
        aria-label={
          `Outline of ${location}, drawn from position telemetry. Raced ${direction}, ` +
          `with ${brakingZones} braking zones marked.`
        }
      >
        {/* Casing under the surface, so the road has an edge and crossings
            read as an over-and-under rather than a merge. */}
        <polyline
          points={geometry.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={casing}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {runs.map((run, i) => (
          <polyline
            key={i}
            points={run.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={run.braking ? "var(--accent)" : "var(--ink-muted)"}
            strokeWidth={road}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {start && (
          <line
            x1={start.x - nx} y1={start.y - ny}
            x2={start.x + nx} y2={start.y + ny}
            stroke="var(--ink)"
            strokeWidth={road * 0.5}
            strokeLinecap="butt"
          />
        )}

        {heading && (
          <polygon
            points={`${-tick * 0.5},${-tick * 0.5} ${tick * 0.6},0 ${-tick * 0.5},${tick * 0.5}`}
            fill="var(--ink)"
            transform={`translate(${heading.x} ${heading.y}) rotate(${heading.angle})`}
          />
        )}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center" style={{ gap: "var(--space-4)" }}>
        {[
          { label: "On power", colour: "var(--ink-muted)" },
          { label: "Braking", colour: "var(--accent)" },
        ].map((k) => (
          <span key={k.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" style={{ width: 14, height: 3, background: k.colour, display: "inline-block" }} />
            <span className="label" style={{ color: "var(--ink-muted)" }}>{k.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" style={{ width: 3, height: 11, background: "var(--ink)", display: "inline-block" }} />
          <span className="label" style={{ color: "var(--ink-muted)" }}>Start / finish</span>
        </span>
      </figcaption>
    </figure>
  );
}
