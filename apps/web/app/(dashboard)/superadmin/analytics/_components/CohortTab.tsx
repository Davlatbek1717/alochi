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

interface CohortUnavailable {
  source: 'unavailable';
  cohorts: [];
}

type CohortResponse = CohortRow[] | CohortUnavailable;

function isUnavailable(data: CohortResponse): data is CohortUnavailable {
  return !Array.isArray(data) && (data as CohortUnavailable).source === 'unavailable';
}

const WEEK_OFFSETS = [1, 2, 3, 4, 5, 6, 7, 8];

export function CohortTab() {
  const [data, setData] = useState<CohortResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<CohortResponse>('/analytics/cohort?weeks=8', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" theme="light" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-full" theme="light" />
        ))}
      </div>
    );
  }

  if (!data || isUnavailable(data)) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="Cohort tahlili hozircha mavjud emas"
        description="Cohort tahlili ClickHouse ulanmagan — bu tab qo'llab-quvvatlanmaydi."
        theme="light"
      />
    );
  }

  const rows = data as CohortRow[];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="Cohort ma'lumotlari yo'q"
        description="Retention hisoblash uchun yetarli ma'lumot mavjud emas"
        theme="light"
      />
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#0f172a] mb-4">
        Cohort Retention (8 hafta)
      </h2>
      <div className="space-y-2 overflow-x-auto">
        <div className="flex items-center gap-1 text-xs text-[#94a3b8] font-medium">
          <span className="w-28">Cohort</span>
          <span className="w-12 text-right">Hajm</span>
          {WEEK_OFFSETS.map((w) => (
            <span key={w} className="w-12 text-center">
              W{w}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.cohortWeek} className="flex items-center gap-1">
            <span className="w-28 text-xs text-[#64748b] font-mono">
              {row.cohortWeek}
            </span>
            <span className="w-12 text-xs text-[#64748b] text-right">
              {row.size}
            </span>
            {WEEK_OFFSETS.map((w) => {
              const value = row.retention[`week${w}`] ?? 0;
              const opacity = Math.min(value / 100, 1);
              return (
                <div
                  key={w}
                  className="w-12 h-9 rounded text-xs flex items-center justify-center font-medium"
                  style={{
                    backgroundColor: `rgba(109, 40, 217, ${opacity * 0.85})`,
                    color: opacity > 0.4 ? '#fff' : '#6d28d9',
                    border: '1px solid #ede9e1',
                  }}
                  title={`W${w}: ${value}%`}
                >
                  {value > 0 ? `${value}%` : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
