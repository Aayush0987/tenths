import Link from "next/link";

import SectionHeading from "@/components/ui/SectionHeading";
import { buildRecords, type RecordHolder } from "@/lib/analysis/records";
import { getAllRaces } from "@/lib/data/aggregate";

/** Attrition records hold a count where the others hold a driver code. */
const isDriver = (who: string) => /^[A-Z]{3}$/.test(who);

function Holder({ holder, rank }: { holder: RecordHolder; rank: number }) {
  return (
    <li className="flex items-baseline" style={{ gap: "var(--space-2)", padding: "4px 0" }}>
      <span className="num" style={{ width: 14, color: "var(--ink-faint)", fontSize: "var(--text-small)" }}>
        {rank}
      </span>

      <span className="num" style={{ minWidth: 42, fontWeight: 700 }}>
        {isDriver(holder.who) ? (
          <Link href={`/driver/${holder.who}`} style={{ color: "inherit" }}>{holder.who}</Link>
        ) : (
          holder.who
        )}
      </span>

      <span className="num" style={{ fontWeight: 650, minWidth: 78 }}>{holder.display}</span>

      <span
        style={{
          fontSize: "var(--text-small)", color: "var(--ink-muted)", flex: 1,
          minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        <Link href={`/${holder.season}/${holder.round}`} style={{ color: "inherit" }}>
          {holder.raceName.replace(" Grand Prix", "")} {holder.season}
        </Link>
        {holder.detail && <span style={{ color: "var(--ink-faint)" }}> · {holder.detail}</span>}
      </span>
    </li>
  );
}

export default async function RecordsPage() {
  const races = await getAllRaces();
  const groups = buildRecords(races);
  const seasons = [...new Set(races.map((r) => r.season))].sort((a, b) => a - b);
  const window = seasons.length > 1 ? `${seasons[0]}–${seasons[seasons.length - 1]}` : String(seasons[0] ?? "");

  return (
    <div className="px-4 py-5">
      <SectionHeading
        label="RECORDS"
        title={`The best of ${window}`}
        note={
          <>
            Across {races.length} races. Everything here is a record that survives being
            compared between circuits — a margin, a gap, a count, a speed, a number of
            places. Lap times are deliberately absent: the quickest lap in the data will
            always be whichever circuit is shortest, so an all-time fastest lap would be a
            fact about the calendar rather than about driving. Circuit bests live on each
            circuit page instead.
          </>
        }
      />

      <div className="grid-2up" style={{ gap: "var(--space-4)", alignItems: "start" }}>
        {groups.map((group) => (
          <section key={group.title} className="card" style={{ padding: "var(--space-4)" }}>
            <h2 style={{ fontSize: "var(--text-lead)", fontWeight: 650 }}>{group.title}</h2>
            <p
              style={{
                fontSize: "var(--text-small)", color: "var(--ink-muted)",
                marginTop: 4, marginBottom: 12, lineHeight: 1.5,
              }}
            >
              {group.note}
            </p>

            {group.entries.map((entry) => (
              <div key={entry.label} style={{ marginBottom: "var(--space-4)" }}>
                <p className="label" style={{ color: "var(--ink-faint)", marginBottom: 2 }}>
                  {entry.label}
                </p>
                {entry.holders.length === 0 ? (
                  <p style={{ fontSize: "var(--text-small)", color: "var(--ink-faint)" }}>
                    Not enough data.
                  </p>
                ) : (
                  <ol style={{ listStyle: "none" }}>
                    {entry.holders.map((h, i) => (
                      <Holder key={`${h.who}-${h.season}-${h.round}-${i}`} holder={h} rank={i + 1} />
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
