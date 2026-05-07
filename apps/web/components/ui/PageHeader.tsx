'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  iconColor?: string;
}

/**
 * Page header — editorial heading + optional icon avatar + actions.
 *
 * Use the `eyebrow` prop for the small uppercase tag above the title
 * (e.g. "TIZIM BOSHQARUVI" → "Superadmin Paneli").
 */
export function PageHeader({
  icon,
  title,
  description,
  eyebrow,
  actions,
  iconColor = 'text-[var(--brand)]',
}: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-7">
      <div className="flex items-start gap-4 min-w-0">
        {icon && (
          <div
            className={[
              'shrink-0 grid place-items-center',
              'w-12 h-12 rounded-2xl',
              'bg-[var(--surface)] border border-[var(--line)]',
              'shadow-[var(--shadow-1)]',
              iconColor,
            ].join(' ')}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ink-4)] mb-1">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] tracking-[-0.01em] truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[var(--ink-3)] mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
