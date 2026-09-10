"use client";

import { useId, useState, type ReactNode } from "react";
import SectionHeading from "@/components/ui/SectionHeading";

interface Props {
  label: string;
  title: ReactNode;
  /** Where caveats go. Most charts here have one worth stating. */
  note?: ReactNode;
  legend?: ReactNode;
  /**
   * The WCAG-clean equivalent. Every chart needs one — colour is never the
   * only way to read a value, and several fills sit below 3:1 by convention.
   */
  table: ReactNode;
  children: ReactNode;
}

export default function ChartFrame({ label, title, note, legend, table, children }: Props) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();

  return (
    <section
      className="mb-6"
      style={{ border: "1px solid var(--border-faint)", background: "var(--surface)" }}
    >
      <div className="px-3 pt-3">
        <SectionHeading
          label={label}
          title={title}
          note={note}
          right={
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-expanded={showTable}
              aria-controls={id}
              className="label"
              style={{
                background: "none",
                border: "1px solid var(--border)",
                padding: "3px 7px",
                cursor: "pointer",
              }}
            >
              {showTable ? "CHART" : "TABLE"}
            </button>
          }
        />
        {legend && <div className="mb-2">{legend}</div>}
      </div>

      {/* Wide charts scroll inside their own box; the page never scrolls sideways. */}
      <div id={id} className="px-3 pb-3" style={{ overflowX: "auto" }}>
        {showTable ? table : children}
      </div>
    </section>
  );
}
