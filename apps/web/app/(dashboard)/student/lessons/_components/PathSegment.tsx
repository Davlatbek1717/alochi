'use client';
import type { FC } from 'react';

interface Props {
  /** Horizontal x-percentage of previous node centre (0..100). */
  fromX: number;
  /** Horizontal x-percentage of current node centre (0..100). */
  toX: number;
  /** Whether this segment is "completed" (gold) or "locked" (grey-dotted). */
  completed: boolean;
  /** Visible vertical height in px (gap between two node rows). */
  height?: number;
}

/**
 * PathSegment — SVG curving connector between two consecutive snake-path
 * nodes. Renders the iconic Duolingo "river" feel using a quadratic curve
 * with a midpoint "swing" perpendicular to the travel direction.
 *
 * The component is intentionally absolute-positioned by its parent — it
 * stretches over a fixed `height` (default 48px) and full width, with the
 * nodes overlapping its top and bottom edges so the curve flows underneath
 * them seamlessly.
 *
 * Visual:
 *   - completed segments: gold (#fbbf24), rounded caps, dotted (`stroke-dasharray: 0,12`)
 *   - locked segments:    grey (#e5e5e5), same dotted treatment
 */
export const PathSegment: FC<Props> = ({ fromX, toX, completed, height = 48 }) => {
  // Convert x-percentages into viewBox coordinates (0..100 wide).
  const x1 = fromX;
  const x2 = toX;
  const y1 = 0;
  const y2 = height;

  // Curve control point — sits at half-height with a horizontal swing toward
  // the midpoint biased outward. We use a simple quadratic Bézier so the
  // path reads as a calm S-curve when fromX != toX.
  const midY = height / 2;
  const midX = (x1 + x2) / 2;

  // For straight-down segments (same column) we still want a tiny wave so the
  // path doesn't look like a hard pipe — biasing the control x by +6.
  const ctrlX = x1 === x2 ? x1 + 6 : midX;

  const path = `M ${x1} ${y1} Q ${ctrlX} ${midY}, ${x2} ${y2}`;
  const stroke = completed ? '#fbbf24' : '#e5e5e5';

  return (
    <svg
      aria-hidden
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className="absolute left-0 right-0 pointer-events-none"
      style={{ top: `calc(50% - ${height / 2}px)` }}
    >
      <path
        d={path}
        stroke={stroke}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="0,12"
        fill="none"
      />
    </svg>
  );
};

export default PathSegment;
