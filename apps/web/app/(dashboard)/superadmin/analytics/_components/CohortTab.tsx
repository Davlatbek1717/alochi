'use client';
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';

interface CohortRow {
  cohortWeek: string;
  size: number;
  retention: Record<string, number>;
}

const WEEK_OFFSETS = [1, 2, 3, 4, 5, 6, 7, 8];

export function CohortTab() {
  const [data, setData] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<CohortRow[]>('/analytics/cohort?weeks=8', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Cohort Retention (8 hafta)</h2>
      {data.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="Cohort ma'lumotlari yo'q"
          description="Retention hisoblash uchun yetarli ma'lumot mavjud emas"
        />
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
                    title={`W${w}: ${value}%`}
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
