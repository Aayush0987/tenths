/**
 * Placeholder home. Replaced in phase 2 by the season selector and the latest
 * race; it exists now so the shell can be looked at.
 */
export default function Home() {
  const rows = [
    ["SEASONS", "2018–2026"],
    ["RACES", "~190"],
    ["ANALYSES PER RACE", "13"],
    ["DATA", "precomputed, committed"],
  ];

  return (
    <div className="px-4 py-6">
      <p className="label">F1 RACE ANALYSIS</p>
      <h1
        style={{
          fontSize: "var(--text-display)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginTop: 4,
          marginBottom: 6,
        }}
      >
        Tenths
      </h1>
      <p style={{ color: "var(--ink-muted)", maxWidth: 560, lineHeight: 1.55 }}>
        What happened in a race, and why. Tyre degradation, where a lap was lost,
        when the race was neutralised — and how any of it compares across nine
        seasons.
      </p>

      <dl
        className="mt-6 inline-grid"
        style={{
          gridTemplateColumns: "auto auto",
          gap: "0 var(--space-5)",
          border: "1px solid var(--border-faint)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--surface-sunken)",
        }}
      >
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="label" style={{ paddingTop: 4, paddingBottom: 4 }}>{k}</dt>
            <dd className="num" style={{ paddingTop: 4, paddingBottom: 4, textAlign: "right" }}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
