"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SearchEntry } from "@/lib/data/searchIndex";

const KINDS: Record<SearchEntry["k"], string> = {
  driver: "DRIVER",
  circuit: "CIRCUIT",
  race: "RACE",
  season: "SEASON",
};

const LIMIT = 9;

/**
 * Score one entry against the query.
 *
 * Deliberately not fuzzy. Subsequence matching would let "ver" find "Silver­stone"
 * as readily as "Verstappen", and on an index where three-letter driver codes
 * are the most likely thing anyone types, that is worse than useless. This
 * ranks exact and prefix matches hard, substring matches softly, and refuses
 * everything else — so "ver" finds Verstappen, and "mon" offers Monza, Monaco
 * and Montréal in a stable order rather than a surprising one.
 *
 * Returns null for no match, so callers can filter.
 */
function score(entry: SearchEntry, query: string): number | null {
  const q = query.toLowerCase();
  const title = entry.t.toLowerCase();
  const alt = (entry.a ?? "").toLowerCase();
  const sub = entry.s.toLowerCase();

  if (title === q || alt === q) return 0;
  if (title.startsWith(q)) return 1;

  // Word starts: "monte carlo" should be found by "carlo".
  if (title.split(/[\s·-]+/).some((w) => w.startsWith(q))) return 2;
  if (alt.split(/[\s·-]+/).some((w) => w.startsWith(q))) return 3;

  if (title.includes(q)) return 4;
  if (alt.includes(q)) return 5;
  if (sub.includes(q)) return 6;
  return null;
}

export default function CommandPalette({ index }: { index: SearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    if (query.trim().length === 0) {
      // With nothing typed, offer the most recent races: the likeliest
      // destination, and it makes the palette useful before you know what to
      // search for.
      return index.filter((e) => e.k === "race").slice(0, LIMIT);
    }
    return index
      .map((entry) => ({ entry, s: score(entry, query.trim()) }))
      .filter((r): r is { entry: SearchEntry; s: number } => r.s !== null)
      .sort((a, b) => a.s - b.s)
      .slice(0, LIMIT)
      .map((r) => r.entry);
  }, [index, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const go = useCallback(
    (entry: SearchEntry | undefined) => {
      if (!entry) return;
      close();
      router.push(entry.h);
    },
    [close, router],
  );

  // Global shortcut. "/" is the convention for search, ⌘K for a palette; both
  // open it. Neither fires while the user is typing somewhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="label"
        aria-label="Search (press /)"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "1px solid var(--border)",
          padding: "3px 8px", cursor: "pointer", color: "var(--ink-muted)",
        }}
      >
        <span>SEARCH</span>
        <kbd
          className="num"
          style={{
            fontSize: 9, border: "1px solid var(--border)", padding: "0 4px",
            color: "var(--ink-faint)",
          }}
        >
          /
        </kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 60, background: "var(--scrim)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "12vh 16px 16px",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 560, background: "var(--surface)",
          border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-lg)",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Reset the highlight here rather than in an effect keyed on the
            // query: it is a consequence of this event, and doing it in an
            // effect costs a second render on every keystroke.
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
          }}
          placeholder="Driver, circuit, race or season…"
          aria-label="Search drivers, circuits, races and seasons"
          aria-activedescendant={results[active] ? `palette-${active}` : undefined}
          style={{
            width: "100%", padding: "12px 14px", background: "transparent",
            border: "none", borderBottom: "1px solid var(--border-faint)",
            color: "var(--ink)", fontSize: "var(--text-lead)", outline: "none",
          }}
        />

        {results.length === 0 ? (
          <p style={{ padding: "14px", fontSize: "var(--text-small)", color: "var(--ink-muted)" }}>
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul ref={listRef} role="listbox" style={{ listStyle: "none", maxHeight: "52vh", overflowY: "auto" }}>
            {results.map((entry, i) => (
              <li
                key={entry.h}
                id={`palette-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); go(entry); }}
                className="flex items-center"
                style={{
                  gap: "var(--space-3)", padding: "7px 14px", cursor: "pointer",
                  background: i === active ? "var(--surface-hover)" : "transparent",
                  boxShadow: i === active ? "inset 2px 0 0 var(--accent)" : "none",
                }}
              >
                <span className="label" style={{ width: 54, color: "var(--ink-faint)" }}>
                  {KINDS[entry.k]}
                </span>
                <span style={{ fontWeight: 600 }}>{entry.t}</span>
                <span
                  className="num ml-auto"
                  style={{
                    fontSize: "var(--text-small)", color: "var(--ink-faint)",
                    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {entry.s}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div
          className="flex items-center"
          style={{
            gap: "var(--space-4)", padding: "6px 14px",
            borderTop: "1px solid var(--border-faint)",
          }}
        >
          {[["↑↓", "move"], ["↵", "open"], ["esc", "close"]].map(([key, what]) => (
            <span key={key} className="flex items-center gap-1.5">
              <kbd className="num" style={{ fontSize: 9, border: "1px solid var(--border)", padding: "0 4px", color: "var(--ink-faint)" }}>
                {key}
              </kbd>
              <span className="label" style={{ color: "var(--ink-faint)" }}>{what}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
