'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  iconColor?: string;
}

export function PageHeader({ icon, title, description, actions, iconColor = 'text-emerald-400' }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className={`shrink-0 w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
