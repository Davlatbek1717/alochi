'use client';
import type { FC } from 'react';

interface StreakFlameProps {
  streak: number;
  hasShield?: boolean;
  size?: number;
  /** Show numeric streak + label next to flame. Set false for compact icon-only. */
  showLabel?: boolean;
}

/**
 * StreakFlame — A'lochi student-panel streak indicator (Pass 2 redesign).
 *
 * Forks the older emoji-based StreakBadge into a hand-drawn SVG flame whose
 * colour escalates with streak depth — mirroring the way Duolingo / Khan
 * Academy give long-streak users a visual reward they can be proud of.
 *
 * Tier scale:
 *   0–2   ash grey      (cold / not started)
 *   3–6   yellow #fbbf24
 *   7–13  orange #ff9500 (the "warm" milestone)
 *   14–29 red    #ef4444
 *   30+   purple #ce82ff (legendary)
 *
 * The `flame-flicker` keyframe gates motion behind motion-safe so reduced-motion
 * users see a static flame.
 */
export const StreakFlame: FC<StreakFlameProps> = ({
  streak,
  hasShield = false,
  size = 36,
  showLabel = true,
}) => {
  const tier = pickTier(streak);

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative"
        style={{ width: size, height: size }}
        aria-label={`${streak} kunlik streak`}
      >
        <svg
          viewBox="0 0 32 36"
          width={size}
          height={size}
          className="motion-safe:animate-[flame-flicker_2s_ease-in-out_infinite] origin-bottom drop-shadow-sm"
        >
          {/* Outer flame */}
          <path
            d="M16 2 C 9 10 4 14 4 22 a12 12 0 0 0 24 0 C 28 16 22 12 20 6 C 19 12 14 14 14 18 C 14 12 17 8 16 2 Z"
            fill={tier.outer}
            stroke={tier.stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Inner flame */}
          <path
            d="M16 14 C 12 18 10 21 10 25 a6 6 0 0 0 12 0 C 22 22 19 19 18 16 C 17.5 19 15 20 15 22 C 15 19 16.5 17 16 14 Z"
            fill={tier.inner}
          />
          {/* Highlight */}
          <ellipse cx="14" cy="22" rx="1.6" ry="3" fill="#fffbe7" opacity="0.7" />
        </svg>
        {hasShield && (
          <span
            className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold border border-white shadow"
            aria-label="Streak shield active"
          >
            ✓
          </span>
        )}
      </div>
      {showLabel && (
        <div className="leading-tight">
          <p className="text-base font-extrabold" style={{ color: tier.text }}>
            {streak}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#777]">
            {tier.label}
          </p>
        </div>
      )}
    </div>
  );
};

interface Tier {
  outer: string;
  inner: string;
  stroke: string;
  text: string;
  label: string;
}

function pickTier(streak: number): Tier {
  if (streak >= 30) {
    return {
      outer: '#ce82ff',
      inner: '#e9c8ff',
      stroke: '#9b4fd1',
      text: '#9b4fd1',
      label: 'Legendar',
    };
  }
  if (streak >= 14) {
    return {
      outer: '#ef4444',
      inner: '#fca5a5',
      stroke: '#b91c1c',
      text: '#b91c1c',
      label: 'Olov',
    };
  }
  if (streak >= 7) {
    return {
      outer: '#ff9500',
      inner: '#fed7aa',
      stroke: '#c2410c',
      text: '#c2410c',
      label: 'Kun',
    };
  }
  if (streak >= 3) {
    return {
      outer: '#fbbf24',
      inner: '#fef3c7',
      stroke: '#b45309',
      text: '#b45309',
      label: 'Kun',
    };
  }
  return {
    outer: '#cbd5e1',
    inner: '#e2e8f0',
    stroke: '#94a3b8',
    text: '#64748b',
    label: 'Kun',
  };
}

export default StreakFlame;
