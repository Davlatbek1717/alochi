'use client';
import { useMemo, type FC } from 'react';

const COLORS = ['#58cc02', '#fbbf24', '#ce82ff', '#1cb0f6', '#ff4b4b'];

interface ConfettiProps {
  /** Number of pieces. Default 30 — small enough to stay smooth on mid-range phones. */
  count?: number;
}

/**
 * Confetti — pure-CSS celebration rain. Renders `count` absolutely-positioned
 * coloured squares that fall from above the viewport using the
 * `confetti-fall` keyframe (translateY + rotate, defined in globals.css).
 *
 * Performance:
 *  - Each piece is a tiny div with a single transform animation; the browser
 *    composites these on the GPU. 30 pieces is well under the budget on
 *    mobile. We avoid re-renders by `useMemo`-ing the random positions.
 *  - Pointer events are disabled so confetti never blocks taps on buttons
 *    underneath.
 *  - Honors `prefers-reduced-motion` automatically — globals.css collapses
 *    animation duration to ~0ms when the user opts out, so no extra guard
 *    is needed here.
 */
export const Confetti: FC<ConfettiProps> = ({ count = 30 }) => {
  // Stable per-mount randoms — re-shuffle would defeat the celebration.
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 1.8 + Math.random() * 1.2,
        color: COLORS[i % COLORS.length],
        size: 8 + Math.random() * 6,
        rotateStart: Math.random() * 360,
      })),
    [count],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute block rounded-[2px] motion-safe:[animation:confetti-fall_2s_linear_forwards]"
          style={{
            left: `${p.left}%`,
            top: '-24px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotateStart}deg)`,
          }}
        />
      ))}
    </div>
  );
};

export default Confetti;
