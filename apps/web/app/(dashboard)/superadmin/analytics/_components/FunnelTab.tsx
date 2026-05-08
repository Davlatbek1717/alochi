'use client';
import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { TrendingDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';

interface Lesson {
  id: string;
  title: string;
}

interface FunnelStep {
  step: string;
  count: number;
}

export function FunnelTab() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((r) => {
        setLessons(r.data);
        if (r.data.length > 0) setSelectedLessonId(r.data[0].id);
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoadingLessons(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedLessonId) return;
    setLoadingFunnel(true);
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<FunnelStep[]>(`/analytics/funnel/${selectedLessonId}`, {}, token)
      .then((r) => setFunnel(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoadingFunnel(false));
  }, [selectedLessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingLessons) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-44" theme="light" />
        <Skeleton className="h-10 w-full rounded-lg" theme="light" />
        <Skeleton className="h-64 w-full rounded-xl" theme="light" />
      </div>
    );
  }

  const allZero = funnel.every((s) => s.count === 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0f172a]">Funnel Tahlili</h2>

      <div>
        <label
          htmlFor="funnel-lesson-select"
          className="block text-xs text-[#64748b] mb-1.5 font-medium"
        >
          Dars tanlang
        </label>
        <select
          id="funnel-lesson-select"
          value={selectedLessonId}
          onChange={(e) => setSelectedLessonId(e.target.value)}
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] focus-visible:ring-2 focus-visible:ring-[#6d28d9]/30 transition-colors"
        >
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      {loadingFunnel ? (
        <Skeleton className="h-64 w-full rounded-xl" theme="light" />
      ) : allZero ? (
        <EmptyState
          icon={<TrendingDown size={24} />}
          title="Funnel ma'lumotlari yo'q"
          description="Tanlangan dars uchun hali hech qanday faollik qayd etilmagan"
          theme="light"
        />
      ) : (
        <div role="img" aria-label="Dars funnel tahlili">
        <ResponsiveContainer
          width="100%"
          height={260}
        >
          <BarChart
            data={funnel.map((s, i) => {
              const prev = i > 0 ? funnel[i - 1].count : 0;
              const dropoff =
                i > 0 && prev > 0 ? ((prev - s.count) / prev) * 100 : 0;
              const label =
                i === 0
                  ? `${s.count}`
                  : `${s.count} (${dropoff.toFixed(1)}% tushish)`;
              return { ...s, dropoff, label };
            })}
            layout="vertical"
            margin={{ left: 80, right: 90 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ede9e1" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#ede9e1' }}
            />
            <YAxis
              dataKey="step"
              type="category"
              tick={{ fontSize: 11, fill: '#64748b' }}
              width={140}
              axisLine={false}
              tickLine={false}
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
              formatter={((
                value: unknown,
                _name: unknown,
                item: unknown,
              ) => {
                const payload = (
                  item as { payload?: { dropoff?: number } } | undefined
                )?.payload;
                const dropoff = payload?.dropoff ?? 0;
                return [
                  `${value} (${dropoff.toFixed(1)}% tushish)`,
                  'count',
                ] as [string, string];
              }) as never}
            />
            <Bar dataKey="count" fill="#6d28d9" radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="label"
                position="right"
                fill="#64748b"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
