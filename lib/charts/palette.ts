import type { Compound } from "@/types/data";

/**
 * Chart colour.
 *
 * Every palette here was checked with a validator rather than chosen by eye,
 * and the reasoning is kept because the conclusions are not obvious. Values
 * live in globals.css as tokens so they can differ per theme where they must.
 */

/* --------------------------------------------------------------------------
 * Tyre compounds — Formula 1's official colours.
 *
 * They pass both discrimination checks (ΔE 17.7 under deuteranopia, 18.2 for
 * normal vision), which are the ones that decide whether a reader can tell two
 * segments apart. They fail the lightness and chroma checks, but only because
 * the hard tyre is white and the medium is bright yellow — conventions this
 * audience reads instantly, where a "corrected" palette would be wrong rather
 * than better. A deepened variant was tried and was worse where it counts:
 * tritan separation fell from 12.1 to 5.9.
 *
 * The one adjustment is hard in the light theme, where #F0F0EC sits at 1.11:1
 * against a pale ground and hard stints drew as blank gaps.
 * -------------------------------------------------------------------------- */
export const COMPOUND_COLORS: Record<Compound, string> = {
  SOFT: "var(--compound-soft)",
  MEDIUM: "var(--compound-medium)",
  HARD: "var(--compound-hard)",
  INTERMEDIATE: "var(--compound-intermediate)",
  WET: "var(--compound-wet)",
  UNKNOWN: "var(--compound-unknown)",
};

export const COMPOUND_ORDER: Compound[] = [
  "SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET", "UNKNOWN",
];

export const COMPOUND_LABELS: Record<Compound, string> = {
  SOFT: "Soft", MEDIUM: "Medium", HARD: "Hard",
  INTERMEDIATE: "Inter", WET: "Wet", UNKNOWN: "Unknown",
};

export const COMPOUND_INITIALS: Record<Compound, string> = {
  SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W", UNKNOWN: "?",
};

/** Ink for a label sitting on a compound fill. */
const ON_COMPOUND: Record<Compound, string> = {
  SOFT: "#ffffff", MEDIUM: "#3a2e00", HARD: "#2a2a26",
  INTERMEDIATE: "#ffffff", WET: "#ffffff", UNKNOWN: "#ffffff",
};

export function compoundColor(c: Compound | string | null): string {
  if (!c) return COMPOUND_COLORS.UNKNOWN;
  return COMPOUND_COLORS[c.toUpperCase() as Compound] ?? COMPOUND_COLORS.UNKNOWN;
}

export function compoundTextColor(c: Compound | string | null): string {
  if (!c) return ON_COMPOUND.UNKNOWN;
  return ON_COMPOUND[c.toUpperCase() as Compound] ?? ON_COMPOUND.UNKNOWN;
}

/* --------------------------------------------------------------------------
 * Team colours — an affordance, never the encoding.
 *
 * Measured as a categorical palette they fail badly: Haas and Alpine are ΔE
 * 1.0 apart under deuteranopia, which is to say identical, and Williams and
 * Haas are ΔE 11.8 for normal vision, below the floor that secondary encoding
 * is allowed to excuse. They are still used, because this audience reads them
 * as identity and a "correct" replacement would be less legible.
 *
 * The rule that makes that safe: every chart drawn in team colours also prints
 * the driver code. Never rely on the colour alone to separate two series, and
 * never use it where the codes cannot be shown.
 * -------------------------------------------------------------------------- */
export const TEAM_COLOR_RULE =
  "Team colour is an affordance, not an encoding: always pair it with the driver code.";

export const FALLBACK_TEAM_COLOR = "#8a8a85";

/* --------------------------------------------------------------------------
 * Everything else
 * -------------------------------------------------------------------------- */

/** Sectors are ordered, so an ordinal ramp: one hue, light to dark. */
export const SECTOR_COLORS = ["var(--sector-1)", "var(--sector-2)", "var(--sector-3)"] as const;
export const SECTOR_LABELS = ["Sector 1", "Sector 2", "Sector 3"] as const;

/** Charts carrying exactly two measures take categorical slots 1 and 2. */
export const SERIES_COLORS = ["var(--series-1)", "var(--series-2)"] as const;

/** A single-series chart colour, where there are no categories to tell apart. */
export const CHART_ACCENT = "var(--chart-accent)";

export const CHART_INK = {
  axis: "var(--ink-faint)",
  grid: "var(--border-faint)",
  label: "var(--ink)",
  muted: "var(--ink-muted)",
  /** Painted between stacked segments so they read as a gap, not a border. */
  surface: "var(--bg)",
} as const;
