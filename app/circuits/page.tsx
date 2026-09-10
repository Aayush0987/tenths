import Link from "next/link";

import SectionHeading from "@/components/ui/SectionHeading";
import { getCircuits } from "@/lib/data/aggregate";

export default async function CircuitsPage() {
  const circuits = await getCircuits();
  const repeated = circuits.filter((c) => c.seasons.length > 1).length;

  return (
    <div className="px-4 py-5">
      <SectionHeading
        label="CIRCUITS"
        title={`${circuits.length} circuits`}
        note={`Grouped by the results feed's circuit identifier rather than by name or location, both of which move between seasons — the same Miami track is listed as "Miami" one year and "Miami Gardens" the next. ${repeated} circuits have run more than once here and can be compared season to season.`}
      />

      <ul style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
        {circuits.map((c, i) => (
          <li key={c.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
            <Link
              href={`/circuit/${encodeURIComponent(c.id)}`}
              className="flex items-center gap-4 px-3 py-2"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span style={{ fontWeight: 600, minWidth: 170 }}>{c.location}</span>
              <span className="label" style={{ color: "var(--ink-faint)", minWidth: 130 }}>{c.country}</span>
              <span style={{ color: "var(--ink-muted)" }}>
                {c.raceName.replace(" Grand Prix", "")}
              </span>
              <span className="num ml-auto" style={{ color: "var(--ink-faint)" }}>
                {c.seasons.join(" ")}
              </span>
              <span className="num" style={{ width: 30, textAlign: "right",
                                             color: c.seasons.length > 1 ? "var(--accent)" : "var(--ink-faint)" }}>
                {c.seasons.length}×
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
