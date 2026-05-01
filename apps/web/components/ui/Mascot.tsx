'use client';
import { type FC } from 'react';

export type MascotExpression = 'idle' | 'happy' | 'sad' | 'sleeping';

interface MascotProps {
  expression?: MascotExpression;
  size?: number;
  className?: string;
  /**
   * When true, applies subtle motion (breathing, wing wave, sway).
   * Set to false to render a static mascot regardless of OS reduced-motion
   * settings. The motion classes use Tailwind's `motion-safe:` variant so
   * users with `prefers-reduced-motion: reduce` will see a static mascot
   * even when this is true.
   */
  animated?: boolean;
}

/**
 * Aloqush — A'lochi's owl mascot ("a'lo" + "qush" / excellent bird).
 *
 * Pure inline SVG; no external assets required. Four expressions:
 *  - idle      open eyes, gentle breathing
 *  - happy     smiling crescent eyes, waving wing
 *  - sad       downturned eyes, droopy posture
 *  - sleeping  closed eyes with "Z" puffs, gentle sway
 *
 * Color is intrinsic (warm yellow body, orange tufts, navy pupils) so it
 * reads consistently against any background. Wrap with the parent's color
 * if you want the body recoloured.
 */
export const Mascot: FC<MascotProps> = ({
  expression = 'idle',
  size = 160,
  className = '',
  animated = true,
}) => {
  // Body sway — applied to the outer group so wings + tufts move together.
  const bodyAnim =
    animated && expression === 'sleeping'
      ? 'motion-safe:[animation:flame-flicker_3s_ease-in-out_infinite] origin-bottom'
      : animated && expression === 'idle'
        ? 'motion-safe:[animation:flame-flicker_4s_ease-in-out_infinite] origin-bottom'
        : '';

  // Right wing wave — only when happy.
  const wingAnim =
    animated && expression === 'happy'
      ? 'motion-safe:[animation:wiggle_1.4s_ease-in-out_infinite] origin-[80px_135px]'
      : '';

  // Whole-mascot bounce-in on happy.
  const rootAnim =
    animated && expression === 'happy'
      ? 'motion-safe:[animation:bounce-in_500ms_ease-out]'
      : '';

  return (
    <svg
      role="img"
      aria-label={`Aloqush mascot (${expression})`}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`${rootAnim} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Soft drop shadow under the body */}
      <ellipse cx="100" cy="178" rx="52" ry="6" fill="#000" opacity="0.12" />

      <g className={bodyAnim}>
        {/* Ear tufts — orange, behind body */}
        <path
          d="M58 50 L44 18 L74 36 Z"
          fill="#ef9b22"
          stroke="#c97a10"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M142 50 L156 18 L126 36 Z"
          fill="#ef9b22"
          stroke="#c97a10"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Body — round warm yellow with tummy */}
        <ellipse
          cx="100"
          cy="108"
          rx="68"
          ry="64"
          fill="#ffd166"
          stroke="#c97a10"
          strokeWidth="3"
        />
        <ellipse cx="100" cy="120" rx="46" ry="44" fill="#fff3c2" />

        {/* Wings */}
        <path
          d="M40 100 Q26 124 40 158 Q56 152 60 130 Q60 112 56 96 Z"
          fill="#ef9b22"
          stroke="#c97a10"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <g className={wingAnim}>
          <path
            d="M160 100 Q174 124 160 158 Q144 152 140 130 Q140 112 144 96 Z"
            fill="#ef9b22"
            stroke="#c97a10"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>

        {/* Eye whites — always rendered as base */}
        <circle cx="78" cy="92" r="18" fill="#ffffff" stroke="#c97a10" strokeWidth="2" />
        <circle cx="122" cy="92" r="18" fill="#ffffff" stroke="#c97a10" strokeWidth="2" />

        {/* Expression-specific eye overlays */}
        {expression === 'idle' && (
          <>
            <circle cx="80" cy="94" r="8" fill="#1f2745" />
            <circle cx="124" cy="94" r="8" fill="#1f2745" />
            <circle cx="83" cy="91" r="2.5" fill="#ffffff" />
            <circle cx="127" cy="91" r="2.5" fill="#ffffff" />
          </>
        )}

        {expression === 'happy' && (
          <>
            {/* Smiling crescent eyes — drawn over whites to mask them */}
            <path
              d="M64 94 Q78 80 92 94"
              fill="none"
              stroke="#1f2745"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M108 94 Q122 80 136 94"
              fill="none"
              stroke="#1f2745"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Cheek blush */}
            <ellipse cx="64" cy="116" rx="6" ry="3.5" fill="#ff8a8a" opacity="0.7" />
            <ellipse cx="136" cy="116" rx="6" ry="3.5" fill="#ff8a8a" opacity="0.7" />
          </>
        )}

        {expression === 'sad' && (
          <>
            {/* Downturned pupils — sit at the bottom of the eye, brows tilted in */}
            <circle cx="80" cy="98" r="7" fill="#1f2745" />
            <circle cx="124" cy="98" r="7" fill="#1f2745" />
            <circle cx="82" cy="96" r="2" fill="#ffffff" />
            <circle cx="126" cy="96" r="2" fill="#ffffff" />
            <path
              d="M64 80 L92 86"
              stroke="#1f2745"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M136 80 L108 86"
              stroke="#1f2745"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Tear */}
            <path
              d="M70 108 Q68 116 72 118 Q76 116 74 108 Z"
              fill="#5dc8ff"
              stroke="#3a9fd6"
              strokeWidth="1"
            />
          </>
        )}

        {expression === 'sleeping' && (
          <>
            {/* Closed eyes — gentle arcs */}
            <path
              d="M64 94 Q78 102 92 94"
              fill="none"
              stroke="#1f2745"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M108 94 Q122 102 136 94"
              fill="none"
              stroke="#1f2745"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Z puffs */}
            <text
              x="148"
              y="56"
              fontFamily="var(--font-nunito), sans-serif"
              fontWeight="800"
              fontSize="18"
              fill="#7a8aa8"
            >
              z
            </text>
            <text
              x="160"
              y="40"
              fontFamily="var(--font-nunito), sans-serif"
              fontWeight="900"
              fontSize="22"
              fill="#5a6f93"
            >
              Z
            </text>
          </>
        )}

        {/* Beak — small triangle, slightly different by mood */}
        {expression === 'sad' ? (
          <path
            d="M100 118 L92 130 L108 130 Z"
            fill="#ef9b22"
            stroke="#c97a10"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M100 118 L91 128 L109 128 Z"
            fill="#ef9b22"
            stroke="#c97a10"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {/* Feet */}
        <path
          d="M82 168 L74 178 M82 168 L82 180 M82 168 L90 178"
          stroke="#c97a10"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M118 168 L110 178 M118 168 L118 180 M118 168 L126 178"
          stroke="#c97a10"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
};

export default Mascot;
