import Link from "next/link";
import { notFound } from "next/navigation";

import CircuitHistoryChart, { type CircuitYear } from "@/components/charts/CircuitHistoryChart";
import SectionHeading from "@/components/ui/SectionHeading";
import { getCircuitRaces, getCircuits } from "@/lib/data/aggregate";
import { cleanLapsFor } from "@/lib/analysis/selectors";
import { formatLap } from "@/lib/format";
import { bestQualifyingSeconds } from "@/lib/analysis/championship";

export async function generateStaticParams() {
  const circuits = await getCircuits();
  return circuits.map((c) => ({ circuit: encodeURIComponent(c.id) }));
}

export default async function CircuitPage({
  params,
}: {
  params: Promise<{ circuit: string }>;
}) {
  const { circuit: rawId } = await params;
  const id = decodeURIComponent(rawId);

  const races = await getCircuitRaces(id);
  if (races.length === 0) notFound();

  const latest = races[races.length - 1];

  const years: CircuitYear[] = races.map((race) => {
    const pole = race.qualifying.find((q) => q.position === 1);
    const poleSeconds = pole ? bestQualifyingSeconds(pole)?.seconds ?? null : null;

    // Fastest race lap, over clean laps only — an in-lap or a lap behind the
    // safety car is not a measure of what the car could do.
    let fastest: { driver: string; seconds: number } | null = null;
    for (const driver of race.drivers) {
      const driverLaps = race.laps.filter((l) => l.driver === driver.code);
      const driverStints = race.stints.filter((st) => st.driver === driver.code);
      for (const lap of cleanLapsFor(driverLaps, driverStints)) {
        if (fastest === null || lap.seconds < fastest.seconds) {
          fastest = { driver: driver.code, seconds: lap.seconds };
        }
      }
    }

    const winner = race.results.find((r) => r.position === 1);
    const stops = race.pitStops.length;
    const finishers = race.results.filter((r) => r.position !== null).length;

    return {
      season: race.season,
      round: race.round,
      raceName: race.raceName,
      date: race.date,
      totalLaps: race.totalLaps,
      poleDriver: pole?.driver ?? null,
      poleSeconds,
      poleLabel: poleSeconds !== null ? formatLap(poleSeconds) : null,
      fastestDriver: fastest?.driver ?? null,
      fastestSeconds: fastest?.seconds ?? null,
      fastestLabel: fastest ? formatLap(fastest.seconds) : null,
      winner: winner?.driver ?? null,
      stopsPerCar: race.drivers.length ? Number((stops / race.drivers.length).toFixed(2)) : null,
      finishers,
      entries: race.drivers.length,
    };
  });

  const withPole = years.filter((y) => y.poleSeconds !== null);
  const swing =
    withPole.length >= 2
      ? withPole[withPole.length - 1].poleSeconds! - withPole[0].poleSeconds!
      : null;

  return (
    <div className="px-4 py-5">
      <SectionHeading
        label="CIRCUIT"
        title={latest.location}
        note={
          <>
            {latest.country} · {races.length} race{races.length === 1 ? "" : "s"} in the
            data ({years.map((y) => y.season).join(", ")}).
            {swing !== null && (
              <>
                {" "}Pole in {withPole[withPole.length - 1].season} was{" "}
                {Math.abs(swing).toFixed(3)}s {swing > 0 ? "slower" : "faster"} than in{" "}
                {withPole[0].season}.
              </>
            )}{" "}
            Lap times across seasons are not like for like: the regulations, the tyre
            compounds and often the surface all changed in between. Read the shape, not
            the tenths.
          </>
        }
      />

      <CircuitHistoryChart years={years} location={latest.location} />

      <section className="mb-6" style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}>
        <div className="px-3 pt-3">
          <SectionHeading
            label="BY SEASON"
            title="Every running"
            note="Fastest race lap is taken over clean laps only — in-laps, out-laps and laps behind the safety car are excluded."
          />
        </div>
        <div className="px-3 pb-3" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-small)" }}>
            <thead>
              <tr>
                {["Season", "Race", "Laps", "Pole", "Pole time", "Fastest lap", "Time", "Winner", "Stops/car", "Finishers"].map((c, i) => (
                  <th key={c} scope="col" className="label"
                      style={{ textAlign: i <= 1 ? "left" : "right", padding: "5px 8px", fontWeight: 600 }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...years].reverse().map((y) => (
                <tr key={y.season} style={{ borderTop: "1px solid var(--border-faint)" }}>
                  <td style={{ padding: "5px 8px", fontWeight: 600 }}>
                    <Link href={`/${y.season}`} style={{ color: "inherit" }}>{y.season}</Link>
                  </td>
                  <td style={{ padding: "5px 8px", color: "var(--ink-muted)" }}>
                    <Link href={`/${y.season}/${y.round}`} style={{ color: "inherit" }}>
                      {y.raceName.replace(" Grand Prix", "")}
                    </Link>
                  </td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>{y.totalLaps}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>{y.poleDriver ?? "—"}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>{y.poleLabel ?? "—"}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>{y.fastestDriver ?? "—"}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right" }}>{y.fastestLabel ?? "—"}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{y.winner ?? "—"}</td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>
                    {y.stopsPerCar ?? "—"}
                  </td>
                  <td className="num" style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-muted)" }}>
                    {y.finishers}/{y.entries}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
