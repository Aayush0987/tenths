import type { ReactNode } from "react";

/** The table half of a chart. Figures are monospace and right-aligned. */
export default function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (ReactNode | number | string | null)[][];
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-small)" }}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className="label"
              style={{ textAlign: i === 0 ? "left" : "right", padding: "5px 8px", fontWeight: 600 }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderTop: "1px solid var(--border-faint)" }}>
            {row.map((cell, j) => (
              <td
                key={j}
                className={j === 0 ? undefined : "num"}
                style={{
                  padding: "5px 8px",
                  textAlign: j === 0 ? "left" : "right",
                  color: j === 0 ? "var(--ink)" : "var(--ink-muted)",
                  fontWeight: j === 0 ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {cell ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
