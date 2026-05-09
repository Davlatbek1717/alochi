'use client';
import { useEffect, useRef, useState, type FC } from 'react';
import { playSound } from '@/lib/sound';

interface DailyGoalRingProps {
  /** Number of lessons completed today. */
  todayLessons: number;
  /** Daily lesson target — defaults to 1. */
  goal?: number;
  /** Fires once when the goal is hit (rising edge). */
  onGoalHit?: () => void;
  /** Diameter in px. */
  size?: number;
}

/**
 * DailyGoalRing — circular SVG progress ring tracking today's completed
 * lessons towards the daily goal. Previously tracked XP; now uses lesson
 * counts instead. Behaviour is identical: stroke fills clockwise, gold
 * when goal is reached, plays a sound effect once.
 */
export const DailyGoalRing: FC<DailyGoalRingProps> = ({
  todayLessons,
  goal = 1,
  onGoalHit,
  size = 140,
}) => {
  const safeGoal = Math.max(1, goal);
  const safeCount = Math.max(0, todayLessons);
  const pct = Math.min(1, safeCount / safeGoal);
  const reached = safeCount >= safeGoal;

  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const hitFiredRef = useRef(false);
  const [animatedPop, setAnimatedPop] = useState(false);

  useEffect(() => {
    if (reached && !hitFiredRef.current) {
      hitFiredRef.current = true;
      setAnimatedPop(true);
      playSound('complete', 0.55);
      onGoalHit?.();
      const t = window.setTimeout(() => setAnimatedPop(false), 600);
      return () => window.clearTimeout(t);
    }
    if (!reached && hitFiredRef.current) {
      hitFiredRef.current = false;
    }
  }, [reached, onGoalHit]);

  const stroke = reached ? '#fbbf24' : '#58cc02';
  const trackStroke = '#e8e0d0';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${
        animatedPop ? 'motion-safe:animate-[pop_500ms_ease-out]' : ''
      }`}
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={safeCount}
      aria-valuemin={0}
      aria-valuemax={safeGoal}
      aria-label={`Bugungi maqsad: ${safeCount} / ${safeGoal} dars`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackStroke}
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset,stroke] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        <span
          className="text-3xl font-extrabold leading-none"
          style={{ color: reached ? '#b45309' : '#3c3c3c' }}
        >
          {safeCount}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#777] mt-1">
          / {safeGoal} dars
        </span>
        {reached && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mt-0.5">
            Maqsad bajarildi!
          </span>
        )}
      </div>
    </div>
  );
};

export default DailyGoalRing;
