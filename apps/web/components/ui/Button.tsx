'use client';
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'success' | 'duo';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

/**
 * A'lochi tactile button.
 *
 * - `primary` — violet brand action with Duolingo-style 4px bottom depth
 *   that compresses on press. Use for "the one thing" on a page.
 * - `secondary` — deep ink, also tactile. Use as the supporting action
 *   beside a primary, never alone.
 * - `tertiary` — outline-only, sits flush. Use for low-emphasis actions.
 * - `ghost` — text-only, no chrome. Toolbar / inline.
 * - `danger` — destructive, requires user confirmation upstream.
 * - `success` — positive confirm (e.g. "to'lov qabul qilindi").
 * - `duo` — student-panel style; preserved for the kids' UI.
 */
const VARIANT_STYLES: Record<Variant, string> = {
  primary: [
    'bg-[var(--brand)] text-white font-extrabold tracking-wide',
    'border-b-[4px] border-x-0 border-t-0 border-b-[var(--brand-deep)]',
    'hover:bg-[var(--brand-strong)]',
    'active:translate-y-[2px] active:border-b-[1px]',
    'disabled:bg-[var(--surface-3)] disabled:text-[var(--ink-4)] disabled:border-b-[var(--line-strong)]',
    'focus-visible:ring-[var(--brand)]',
  ].join(' '),
  secondary: [
    'bg-[var(--ink)] text-white font-extrabold tracking-wide',
    'border-b-[4px] border-x-0 border-t-0 border-b-[#0a0717]',
    'hover:bg-[#2a2660]',
    'active:translate-y-[2px] active:border-b-[1px]',
    'disabled:bg-[var(--surface-3)] disabled:text-[var(--ink-4)] disabled:border-b-[var(--line-strong)]',
    'focus-visible:ring-[var(--ink)]',
  ].join(' '),
  tertiary: [
    'bg-[var(--surface)] text-[var(--ink)] font-bold',
    'border-[1.5px] border-[var(--line-strong)]',
    'hover:border-[var(--ink)] hover:bg-[var(--surface-2)]',
    'active:translate-y-[1px]',
    'disabled:opacity-50',
    'focus-visible:ring-[var(--ink)]',
  ].join(' '),
  ghost: [
    'bg-transparent text-[var(--ink-2)] font-semibold',
    'border-transparent',
    'hover:bg-[var(--surface-3)] hover:text-[var(--ink)]',
    'disabled:opacity-50',
    'focus-visible:ring-[var(--ink)]',
  ].join(' '),
  danger: [
    'bg-[var(--danger)] text-white font-extrabold tracking-wide',
    'border-b-[4px] border-x-0 border-t-0 border-b-[#7f1d1d]',
    'hover:brightness-105',
    'active:translate-y-[2px] active:border-b-[1px]',
    'disabled:opacity-50',
    'focus-visible:ring-[var(--danger)]',
  ].join(' '),
  success: [
    'bg-[var(--success)] text-white font-extrabold tracking-wide',
    'border-b-[4px] border-x-0 border-t-0 border-b-[#14532d]',
    'hover:brightness-105',
    'active:translate-y-[2px] active:border-b-[1px]',
    'disabled:opacity-50',
    'focus-visible:ring-[var(--success)]',
  ].join(' '),
  // Student-panel Duolingo-style — preserved unchanged for the kids' UI.
  duo: [
    'bg-[#58cc02] hover:brightness-105 text-white font-extrabold uppercase tracking-wide',
    'border-b-[4px] border-l-0 border-r-0 border-t-0 border-[#46a302]',
    'rounded-2xl',
    'active:translate-y-[2px] active:border-b-[2px]',
    'disabled:bg-[#e8e0d0] disabled:border-[#cbbf9c] disabled:text-[#a0a0a0]',
  ].join(' '),
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'px-3 py-1.5 min-h-[36px] text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 min-h-[40px] text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 min-h-[44px] text-sm gap-2 rounded-xl',
  xl: 'px-8 py-4 min-h-[52px] text-base gap-2.5 rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    icon,
    iconRight,
    fullWidth,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center',
        'transition-all duration-150 ease-out',
        'disabled:cursor-not-allowed',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth ? 'w-full' : '',
        variant === 'duo' ? '' : '', // duo brings its own rounded-2xl
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
});
