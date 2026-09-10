import Link from "next/link";

import SectionHeading from "@/components/ui/SectionHeading";
import { buildStandings } from "@/lib/analysis/championship";
import { SEASONS, getDrivers, getSeasonRaces } from "@/lib/data/aggregate";

export default async function DriversPage() {
  const drivers = await getDrivers();

  // Career totals across the seasons held, computed once here rather than per
  // driver page, so the list can be ranked by something meaningful.
  const totals = new Map<string, { points: number; wins: number; podiums: number; starts: number }>();
  for (const season of SEASONS) {
    const standings = buildStandings(await getSeasonRaces(season));
    for (const row of standings.drivers) {
      const t = totals.get(row.code) ?? { points: 0, wins: 0, podiums: 0, starts: 0 };
      t.points += row.points;
      t.wins += row.wins;
      t.podiums += row.podiums;
      t.starts += row.starts;
      totals.set(row.code, t);
    }
  }

  const ranked = [...drivers].sort((a, b) => {
    const at = totals.get(a.code)?.points ?? 0;
    const bt = totals.get(b.code)?.points ?? 0;
    return bt - at || a.code.localeCompare(b.code);
  });

  return (
    <div className="px-4 py-5">
      <SectionHeading
        label="DRIVERS"
        title={`${drivers.length} drivers`}
        note={`Everyone who started a race in ${[...SEASONS].reverse().join(", ")}. Totals cover only those seasons, not a full career. Points include sprints.`}
      />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-small)",
                      border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-faint)" }}>
            {["Driver", "Team", "Seasons", "Starts", "Wins", "Podiums", "Points"].map((c, i) => (
              <th key={c} scope="col" className="label"
                  style={{ textAlign: i <= 1 ? "left" : "right", padding: "6px 8px", fontWeight: 600 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.map((d) => {
            const t = totals.get(d.code);
            return (
              <tr key={d.code} style={{ borderTop: "1px solid var(--border-faint)" }}>
                <td style={{ padding: "6px 8px" }}>
                  <Link href={`/driver/${d.code}`} className="flex items-center gap-2"
                        style={{ color: "inherit", textDecoration: "none" }}>
                    <span aria-hidden="true"
                          style={{ width: 3, height: 13, background: d.teamColor ?? "var(--ink-faint)", display: "inline-block" }} />
                    <span className="num" style={{ fontWeight: 600 }}>{d.code}</span>
                    <span style={{ color: "var(--ink-muted)" }}>{d.name}</span>
                  </Link>
                </td>
                <td style={{ padding: "6px 8px", color: "var(--ink-muted)" }}>{d.team}</td>
                <td className="num" style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-faint)" }}>
                  {d.seasons.join(" ")}
                </td>
                <td className="num" style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-muted)" }}>{t?.starts ?? 0}</td>
                <td className="num" style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-muted)" }}>{t?.wins ?? 0}</td>
                <td className="num" style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-muted)" }}>{t?.podiums ?? 0}</td>
                <td className="num" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{t?.points ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
