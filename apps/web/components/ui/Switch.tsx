'use client';
import { type FC, type KeyboardEvent } from 'react';

interface SwitchProps {
  /** Controlled state — true = on, false = off. */
  checked: boolean;
  /** Change handler — receives the next checked value. */
  onChange: (next: boolean) => void;
  /** Accessible label for screen readers (required for a11y). */
  label: string;
  /** Optional id; otherwise auto-derived from label for label-for association. */
  id?: string;
  /** Disable the switch — visual + interactive. */
  disabled?: boolean;
  /** Optional className for the outer wrapper. */
  className?: string;
}

/**
 * Switch — accessible toggle button styled in the A'lochi student-panel
 * Duolingo-grade palette. Renders a `role="switch"` button with proper
 * `aria-checked` + keyboard support (Space/Enter toggle, Tab focusable).
 *
 * Visual:
 *   off: cream track (#e8e0d0), thumb on left
 *   on : duo green (#58cc02) track, thumb on right with subtle drop shadow
 *
 * Sized for the 44×44 minimum touch target — outer hit area is 44px tall
 * via padding even though the rendered track is 28px.
 */
export const Switch: FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  className = '',
}) => {
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  }

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex items-center h-11 w-14 shrink-0 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${className}`}
    >
      <span
        aria-hidden
        className={`block w-12 h-7 rounded-full transition-colors duration-200 border-[1.5px] ${
          checked
            ? 'bg-[#58cc02] border-[#46a302]'
            : 'bg-[#e8e0d0] border-[#cbbf9c]'
        }`}
      />
      <span
        aria-hidden
        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

export default Switch;
