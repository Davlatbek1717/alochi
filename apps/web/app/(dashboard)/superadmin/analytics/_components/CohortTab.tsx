'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface CohortRow {
  cohortWeek: string;
  size: number;
  retention: Record<string, number>;
}

const WEEK_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function CohortTab() {
  const [data, setData] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<CohortRow[]>('/analytics/cohort?weeks=8', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Cohort Retention (8 hafta)</h2>
      {data.length === 0 ? (
        <p className="text-slate-500 text-sm">Ma&apos;lumot yo&apos;q</p>
      ) : (
        <div className="space-y-2 overflow-x-auto">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <span className="w-28">Cohort</span>
            <span className="w-12 text-right">Hajm</span>
            {WEEK_OFFSETS.map((w) => (
              <span key={w} className="w-12 text-center">W{w}</span>
            ))}
          </div>
          {data.map((row) => (
            <div key={row.cohortWeek} className="flex items-center gap-1">
              <span className="w-28 text-xs text-slate-300 font-mono">{row.cohortWeek}</span>
              <span className="w-12 text-xs text-slate-300 text-right">{row.size}</span>
              {WEEK_OFFSETS.map((w) => {
                const value = row.retention[`week${w}`] ?? 0;
                const opacity = Math.min(value / 100, 1);
                return (
                  <div
                    key={w}
                    className="w-12 h-9 rounded text-xs flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: `rgba(16, 185, 129, ${opacity})`, border: '1px solid #1e293b' }}
                  >
                    {value > 0 ? `${value}%` : '—'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
