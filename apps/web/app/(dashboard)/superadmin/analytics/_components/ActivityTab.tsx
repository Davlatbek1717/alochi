'use client';
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Activity } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState, useToast } from '@/components/ui';

interface ActivityPoint {
  day: string;
  count: number;
}

type Period = 'weekly' | 'monthly';

export function ActivityTab() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [data, setData] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ActivityPoint[]>(
      `/analytics/activity?period=${period}`,
      {},
      token,
    )
      .then((r) => setData(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodLabel = period === 'weekly' ? 'So\'nggi 7 kun' : 'So\'nggi 30 kun';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-[#0f172a]">
          Faol o&apos;quvchilar — {periodLabel}
        </h2>

        {/* Period toggle */}
        <div
          role="group"
          aria-label="Davr tanlang"
          className="flex gap-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl p-1"
        >
          {(['weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9]/50 ${
                period === p
                  ? 'bg-[#0f172a] text-white'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {p === 'weekly' ? 'Hafta' : 'Oy'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" theme="light" />
          <Skeleton className="h-64 w-full rounded-xl" theme="light" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Activity size={24} />}
          title="Faollik ma'lumotlari yo'q"
          description={`${periodLabel} uchun faol o'quvchilar statistikasi topilmadi`}
          theme="light"
        />
      ) : (
        <div role="img" aria-label={`Faol o'quvchilar grafigi — ${periodLabel}`}>
        <ResponsiveContainer
          width="100%"
          height={260}
        >
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ede9e1" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#ede9e1' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1.5px solid #ede9e1',
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                fontSize: 12,
              }}
              labelStyle={{ color: '#0f172a', fontWeight: 600 }}
              itemStyle={{ color: '#6d28d9' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#6d28d9"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#6d28d9', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
