"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useHydrated } from "@/lib/useHydrated";

const KEY = "tenths-theme";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = window.matchMedia?.("(prefers-color-scheme: light)");
  media?.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    media?.removeEventListener("change", onChange);
  };
}

/**
 * The live theme, read from <html data-theme> which the pre-paint script sets.
 * With no explicit choice the OS decides — and dark is the default here, so
 * only an explicit light preference switches it.
 */
function getSnapshot(): "dark" | "light" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const getServerSnapshot = (): "dark" | "light" => "dark";

export default function ThemeToggle() {
  const hydrated = useHydrated();
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage: applies for this view, just not remembered.
    }
    listeners.forEach((notify) => notify());
  }, []);

  if (!hydrated) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "light"}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="label"
      style={{
        background: "none",
        border: "1px solid var(--border)",
        padding: "3px 7px",
        cursor: "pointer",
        color: "var(--ink-muted)",
      }}
    >
      {theme === "dark" ? "LIGHT" : "DARK"}
    </button>
  );
}
