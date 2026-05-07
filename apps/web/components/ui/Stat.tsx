'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; positive: boolean };
  color?: string;
  theme?: 'light' | 'dark';
}

/**
 * KPI / stat card. Editorial: display serif for the value (tabular nums
 * for alignment), small-caps tracking-wide label, optional trend pill.
 */
export function Stat({
  icon,
  label,
  value,
  sub,
  trend,
  color = 'text-[var(--brand)]',
  theme = 'light',
}: Props) {
  const isLight = theme === 'light';
  return (
    <div
      className={[
        'group rounded-2xl p-5',
        'transition-all duration-200 ease-out',
        isLight
          ? [
              'bg-[var(--surface)]',
              'border border-[var(--line)]',
              'shadow-[var(--shadow-1)]',
              'hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)] hover:border-[var(--line-strong)]',
            ].join(' ')
          : [
              'bg-slate-800/60',
              'border border-slate-700',
              'hover:border-slate-600',
            ].join(' '),
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3.5">
        {icon ? (
          <span
            className={[
              'grid place-items-center w-10 h-10 rounded-xl',
              'bg-[var(--surface-2)]',
              color,
              'transition-transform duration-200 group-hover:scale-105',
            ].join(' ')}
          >
            {icon}
          </span>
        ) : (
          <span />
        )}
        {trend && (
          <span
            className={[
              'inline-flex items-center gap-0.5',
              'text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full',
              trend.positive
                ? 'text-[var(--success)] bg-[var(--success-soft)]'
                : 'text-[var(--danger)] bg-[var(--danger-soft)]',
            ].join(' ')}
          >
            {trend.positive ? '+' : ''}
            {trend.value}%
          </span>
        )}
      </div>
      <p
        className={[
          'font-display text-3xl font-bold tabular-nums leading-none tracking-[-0.02em]',
          isLight ? 'text-[var(--ink)]' : 'text-white',
        ].join(' ')}
      >
        {value}
      </p>
      <p
        className={[
          'text-[11px] font-extrabold uppercase tracking-[0.16em] mt-3',
          isLight ? 'text-[var(--ink-3)]' : 'text-slate-400',
        ].join(' ')}
      >
        {label}
      </p>
      {sub && (
        <p
          className={[
            'text-xs mt-1.5',
            isLight ? 'text-[var(--ink-4)]' : 'text-slate-500',
          ].join(' ')}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
