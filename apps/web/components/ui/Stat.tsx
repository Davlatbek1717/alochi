'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; positive: boolean };
  color?: string;
}

export function Stat({ icon, label, value, sub, trend, color = 'text-emerald-400' }: Props) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-3">
        {icon && <span className={color}>{icon}</span>}
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend.positive ? 'text-emerald-400 bg-emerald-900/30' : 'text-red-400 bg-red-900/30'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
