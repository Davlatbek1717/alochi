'use client';
import { useEffect } from 'react';

/**
 * No-op stub. The "+N XP" floating chip used to animate up and fade
 * after every correct answer; per UX cleanup, all XP messaging was
 * stripped from the student-facing flow. Rather than rip XpFloater
 * out of all twelve exercise components, the component is now a
 * silent component that fires its `onDone` callback once and renders
 * nothing.
 *
 * The callback path matters because some consumers gate state on it
 * (e.g. resetting a `showFloater` flag). Calling onDone immediately
 * keeps that state machine moving without making the chip visible.
 */
interface XpFloaterProps {
  amount: number;
  durationMs?: number;
  onDone?: () => void;
  className?: string;
}

export function XpFloater({ onDone }: XpFloaterProps) {
  useEffect(() => {
    onDone?.();
    // Fire-and-forget; the callback is a parent state setter that
    // tolerates being invoked synchronously on mount.
  }, [onDone]);

  return null;
}

export default XpFloater;
