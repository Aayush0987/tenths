import type { CircuitCharacter } from "@/lib/analysis/circuit";
import { formatLap } from "@/lib/format";

/**
 * What kind of circuit this is, in figures.
 *
 * Every value is measured from the reference lap's own telemetry rather than
 * quoted from a specification sheet, and the wording says so — the distance
 * here is the length of the line the car drove, which is a little under the
 * circuit's published length because the racing line cuts every apex and
 * because the trace is sampled. Calling it "lap distance measured" rather
 * than "circuit length" is the difference between a derived figure and a
 * wrong one.
 *
 * Corner count is deliberately absent. It is not in the data, and inferring
 * it from curvature would produce a number that looks authoritative and
 * disagrees with the official one. Braking zones are counted instead, which
 * is a real measurement of the same idea.
 */
export default function CircuitFacts({
  character,
  raceLaps,
}: {
  character: CircuitCharacter;
  raceLaps: number;
}) {
  const raceDistanceKm =
    character.lapMetres !== null ? (character.lapMetres * raceLaps) / 1000 : null;

  const rows: { label: string; value: string; note?: string }[] = [
    {
      label: "Lap distance measured",
      value: character.lapMetres !== null ? `${(character.lapMetres / 1000).toFixed(3)} km` : "—",
      note: "along the racing line",
    },
    {
      label: "Race distance",
      value: raceDistanceKm !== null ? `${raceDistanceKm.toFixed(0)} km` : "—",
      note: `${raceLaps} laps`,
    },
    { label: "Direction", value: character.direction === "clockwise" ? "Clockwise" : "Anticlockwise" },
    {
      label: "Full throttle",
      value: character.fullThrottlePercent !== null ? `${character.fullThrottlePercent}%` : "—",
      note: "of the lap",
    },
    {
      label: "On the brakes",
      value: character.brakingPercent !== null ? `${character.brakingPercent}%` : "—",
      note: "of the lap",
    },
    { label: "Braking zones", value: String(character.brakingZones) },
    {
      label: "Top speed",
      value: character.topSpeedKph !== null ? `${Math.round(character.topSpeedKph)} kph` : "—",
      note: "reference lap",
    },
    {
      label: "Average speed",
      value: character.averageSpeedKph !== null ? `${Math.round(character.averageSpeedKph)} kph` : "—",
      note: character.lapSeconds !== null ? formatLap(character.lapSeconds) : undefined,
    },
  ];

  return (
    <div>
      <p className="label">CHARACTER</p>
      <p
        style={{
          fontSize: "var(--text-small)", color: "var(--ink-muted)",
          margin: "6px 0 10px", lineHeight: 1.5,
        }}
      >
        Measured off {character.referenceDriver}&rsquo;s {character.season} qualifying lap. The
        share of a lap spent at full throttle says more about a circuit than a corner
        count does — it is what separates Monza from Monaco in a single figure.
      </p>

      <dl style={{ display: "grid", gap: 1, background: "var(--border-faint)" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between"
            style={{ background: "var(--surface)", padding: "7px 10px", gap: "var(--space-3)" }}
          >
            <dt className="label" style={{ color: "var(--ink-faint)" }}>{row.label}</dt>
            <dd className="num" style={{ fontWeight: 650, textAlign: "right" }}>
              {row.value}
              {row.note && (
                <span
                  className="label"
                  style={{ color: "var(--ink-faint)", fontWeight: 400, marginLeft: 6 }}
                >
                  {row.note}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
