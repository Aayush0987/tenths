import { CHART_INK } from "@/lib/charts/palette";

interface ShapeProps<T> {
  x?: number; y?: number; width?: number; height?: number; payload?: T;
}

interface Options<T> {
  floor: number;
  ceiling: number;
  value: (row: T) => number;
  label: (row: T) => string;
  color: string;
}

/**
 * A dot-plot mark: a hairline guide across the row and a dot at the value.
 *
 * Why a dot and not a bar, for both charts that use this: their values sit in
 * a narrow band well above zero — lap-time spreads around a second, speed
 * traps around 340km/h — so bars measured from zero come out all but identical
 * and the ranking disappears. Truncating a bar axis would misstate the
 * lengths, because a bar's length is its value; a dot encodes position and can
 * sit on a scale that starts near the data.
 *
 * The guide needs the plot width, which Recharts does not pass to a shape. It
 * is recovered from the axis: a bar's width is its value's share of the
 * domain, so scaling back up by the domain span gives the whole.
 */
export function makeDotShape<T>({ floor, ceiling, value, label, color }: Options<T>) {
  function DotShape({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps<T>) {
    if (!payload) return null;
    const cy = y + height / 2;
    const cx = x + width;
    const span = value(payload) - floor;
    const plotWidth = span > 0 ? (width * (ceiling - floor)) / span : width;

    return (
      <g>
        <line x1={x} x2={x + plotWidth} y1={cy} y2={cy} stroke={CHART_INK.grid} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={3.5} fill={color} />
        <text
          x={cx + 7} y={cy} dominantBaseline="central"
          fontSize={9} fill={CHART_INK.muted}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {label(payload)}
        </text>
      </g>
    );
  }
  DotShape.displayName = "DotShape";
  return DotShape;
}
