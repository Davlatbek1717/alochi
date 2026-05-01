'use client';
import { useEffect, useState } from 'react';

/**
 * Pass 5 helper — small `+N XP` chip that floats up and fades out.
 *
 * Drops in absolutely-positioned over a parent container; the parent supplies
 * the trigger by mounting/unmounting this component (or by changing the `key`
 * prop). The float-up keyframe is defined in `globals.css`.
 *
 * The element auto-removes itself after the animation duration so consumers
 * don't have to manage timeouts. Pass `onDone` if you want a callback when the
 * float finishes (e.g. to clear a parent state flag).
 */
interface XpFloaterProps {
  amount: number;
  /** ms — must match (or exceed) the float-up keyframe duration. */
  durationMs?: number;
  /** Optional callback once the float-up animation finishes. */
  onDone?: () => void;
  className?: string;
}

export function XpFloater({ amount, durationMs = 900, onDone, className = '' }: XpFloaterProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onDone]);

  if (!visible) return null;

  return (
    <span
      className={`pointer-events-none select-none font-extrabold text-[#fbbf24] drop-shadow-[0_1px_0_rgba(0,0,0,0.18)] motion-safe:[animation:float-up_900ms_ease-out_forwards] ${className}`}
      style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
    >
      +{amount} XP
    </span>
  );
}

export default XpFloater;
