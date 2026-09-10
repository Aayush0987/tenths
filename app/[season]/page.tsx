import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeasonIndex } from "@/lib/data/read";
import SectionHeading from "@/components/ui/SectionHeading";

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const index = await getSeasonIndex(Number(season));
  if (!index || index.races.length === 0) notFound();

  const withTelemetry = index.races.filter((r) => r.hasTelemetry).length;

  return (
    <div className="px-4 py-5">
      <SectionHeading
        label={`SEASON ${index.season}`}
        title={`${index.races.length} races`}
        note={
          withTelemetry === index.races.length
            ? "Telemetry available for every round."
            : withTelemetry === 0
              ? "No telemetry published for this season — track maps and traces are unavailable."
              : `Telemetry available for ${withTelemetry} of ${index.races.length} rounds.`
        }
      />

      <ul style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
        {index.races.map((race, i) => (
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
              <span className="label" style={{ color: "var(--ink-faint)" }}>{race.location}</span>
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
        ))}
      </ul>
    </div>
  );
}
