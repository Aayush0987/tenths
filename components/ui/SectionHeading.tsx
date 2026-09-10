import type { ReactNode } from "react";

/**
 * Label above, title below. No display serif — figures and headings share the
 * same grotesque here, because the page is a readout rather than an article.
 */
export default function SectionHeading({
  label,
  title,
  note,
  right,
}: {
  label: string;
  title: ReactNode;
  note?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <p className="label">{label}</p>
        <h2
          style={{
            fontSize: "var(--text-lead)",
            fontWeight: 650,
            letterSpacing: "-0.01em",
            marginTop: 2,
          }}
        >
          {title}
        </h2>
        {note && (
          <p
            style={{
              fontSize: "var(--text-small)",
              color: "var(--ink-muted)",
              marginTop: 6,
              maxWidth: 760,
              lineHeight: 1.5,
            }}
          >
            {note}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
