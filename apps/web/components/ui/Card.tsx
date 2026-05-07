'use client';
import { ReactNode, HTMLAttributes } from 'react';

type Variant = 'default' | 'elevated' | 'soft' | 'outline' | 'dark';
type Padding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: Padding;
  variant?: Variant;
  hoverable?: boolean;
}

/**
 * A'lochi card surface.
 *
 * - `default` — cream-on-cream with hairline border. Use as default panel.
 * - `elevated` — same but with shadow-3 lift; reach for landing CTAs and
 *   anything that should feel "ready to be tapped".
 * - `soft` — slightly warmer fill (surface-2) for grouping panels inside
 *   a default card without nesting borders.
 * - `outline` — no fill, just a 1.5px border. Inline tables, settings
 *   rows, low-emphasis groups.
 * - `dark` — preserved for the legacy admin slate aesthetic. Avoid for
 *   new work — `default` is preferred.
 */
const VARIANT: Record<Variant, string> = {
  default:
    'bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-[var(--shadow-1)]',
  elevated:
    'bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-[var(--shadow-3)]',
  soft:
    'bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl',
  outline:
    'bg-transparent border-[1.5px] border-[var(--line-strong)] rounded-2xl',
  dark:
    'bg-slate-800/60 border border-slate-700 rounded-xl',
};

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  padding = 'md',
  variant = 'default',
  hoverable,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        VARIANT[variant],
        PADDING[padding],
        hoverable
          ? 'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)] hover:border-[var(--line-strong)]'
          : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 pb-4 border-b border-[var(--line)] ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`font-display text-xl font-bold text-[var(--ink)] tracking-tight ${className}`}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-[var(--ink-3)] mt-1 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

/** Compact subtitle inside cards — uppercase tracking-wide eyebrow. */
export function CardEyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-[10px] uppercase tracking-[0.18em] font-extrabold text-[var(--ink-4)] ${className}`}
    >
      {children}
    </p>
  );
}
