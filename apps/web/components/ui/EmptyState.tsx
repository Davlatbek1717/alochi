'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  theme?: 'light' | 'dark';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  theme = 'light',
  className = '',
}: Props) {
  const isLight = theme === 'light';
  return (
    <div className={`text-center py-16 px-6 ${className}`}>
      {icon && (
        <div
          className={[
            'mx-auto mb-5 w-20 h-20 rounded-3xl',
            'grid place-items-center',
            isLight
              ? 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink-3)] shadow-[var(--shadow-1)]'
              : 'bg-slate-800/80 border border-slate-700 text-slate-500',
          ].join(' ')}
        >
          {icon}
        </div>
      )}
      <h3
        className={[
          'font-display text-lg font-bold mb-2 tracking-[-0.005em]',
          isLight ? 'text-[var(--ink)]' : 'text-slate-200',
        ].join(' ')}
      >
        {title}
      </h3>
      {description && (
        <p
          className={[
            'text-sm max-w-sm mx-auto leading-relaxed',
            isLight ? 'text-[var(--ink-3)]' : 'text-slate-400',
          ].join(' ')}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
