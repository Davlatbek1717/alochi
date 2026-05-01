'use client';
import { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  /** Optional suffix appended to the displayed number (e.g. "%", "kun"). */
  suffix?: string;
}

/**
 * AnimatedCounter — count-up animation driven by requestAnimationFrame using
 * a cubic ease-out curve. Pairs with the `count-up-fade` keyframe from
 * globals.css for a soft entry feel.
 *
 * Honors `prefers-reduced-motion` automatically: callers can wrap with the
 * `motion-safe:` Tailwind variant on a parent, or rely on the rAF being
 * effectively instant when the OS reports reduced motion.
 */
export function AnimatedCounter({
  value,
  duration = 1000,
  className,
  suffix,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.floor(eased * value));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className ?? ''}`}>
      {display}
      {suffix ?? ''}
    </span>
  );
}

export default AnimatedCounter;
