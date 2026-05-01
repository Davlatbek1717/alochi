'use client';
import { type FC } from 'react';

interface HeartsProps {
  remaining: number;
  max?: number;
}

/**
 * Hearts — Duolingo-style "lives" indicator that replaces the wrongs counter.
 *
 * Renders `max` heart icons (default 3):
 *   - filled (red gradient) for `remaining` hearts
 *   - empty (grey outline) for hearts already lost
 *
 * Lost hearts get a subtle pop-shrink animation via the `animate-[pop_…]`
 * keyframe defined in globals.css. The filled hearts use a red gradient that
 * matches the Duolingo palette (`#ff4b4b`), and the outline hearts use the
 * cream-line tone (`#e8e0d0`) so they sit calmly on the cream theme.
 *
 * The component is purely visual — parent owns the `remaining` state and
 * decrements it on wrong answers.
 */
export const Hearts: FC<HeartsProps> = ({ remaining, max = 3 }) => {
  const safeMax = Math.max(1, max);
  const safeRemaining = Math.max(0, Math.min(safeMax, remaining));

  return (
    <div
      className="flex items-center gap-1"
      role="status"
      aria-label={`${safeRemaining} ta yurakdan ${safeMax}`}
    >
      {Array.from({ length: safeMax }).map((_, i) => {
        const filled = i < safeRemaining;
        // Index of the heart that was *just* lost (if any) — animate it.
        const justLost = i === safeRemaining;
        return (
          <Heart key={i} filled={filled} animate={!filled && justLost} />
        );
      })}
    </div>
  );
};

interface HeartProps {
  filled: boolean;
  animate: boolean;
}

const Heart: FC<HeartProps> = ({ filled, animate }) => {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={22}
        height={22}
        aria-hidden
        className="motion-safe:[animation:bounce-in_300ms_ease-out]"
      >
        <defs>
          <linearGradient id="alc-heart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b6b" />
            <stop offset="100%" stopColor="#ff4b4b" />
          </linearGradient>
        </defs>
        <path
          d="M12 21s-7-4.35-9.5-9.05C.6 8.4 2.7 4.5 6.4 4.5c2 0 3.4 1 4.6 2.5h2c1.2-1.5 2.6-2.5 4.6-2.5 3.7 0 5.8 3.9 3.9 7.45C19 16.65 12 21 12 21Z"
          fill="url(#alc-heart-fill)"
          stroke="#c92626"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      className={animate ? 'motion-safe:[animation:pop_400ms_ease-out]' : ''}
    >
      <path
        d="M12 21s-7-4.35-9.5-9.05C.6 8.4 2.7 4.5 6.4 4.5c2 0 3.4 1 4.6 2.5h2c1.2-1.5 2.6-2.5 4.6-2.5 3.7 0 5.8 3.9 3.9 7.45C19 16.65 12 21 12 21Z"
        fill="#f3eedf"
        stroke="#cbbf9c"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Hearts;
