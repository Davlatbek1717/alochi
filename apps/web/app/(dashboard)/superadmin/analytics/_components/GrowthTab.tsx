'use client';
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState, useToast } from '@/components/ui';

interface GrowthPoint {
  date: string;
  newStudents: number;
  activeStudents: number;
}
interface GrowthResp {
  totalStudents: number;
  days: GrowthPoint[];
}

export function GrowthTab() {
  const [days, setDays] = useState<30 | 90>(30);
  const [data, setData] = useState<GrowthResp | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<GrowthResp>(`/analytics/growth?days=${days}`, {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const points = data?.days ?? [];
  const newTotal = points.reduce((s, p) => s + p.newStudents, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-[#0f172a]">
          Oʻsish — soʻnggi {days} kun
        </h2>
        <div
          role="group"
          aria-label="Davr"
          className="flex gap-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl p-1"
        >
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                days === d
                  ? 'bg-[#0f172a] text-white'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {d} kun
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" theme="light" />
          <Skeleton className="h-64 w-full rounded-xl" theme="light" />
        </div>
      ) : points.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="Maʼlumot yoʻq"
          description="Tanlangan davr uchun oʻsish statistikasi topilmadi"
          theme="light"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-extrabold text-[#0f172a]">
                {data?.totalStudents ?? 0}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                Jami faol oʻquvchi
              </p>
            </div>
            <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-extrabold text-[#0f172a]">
                +{newTotal}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                Yangi ({days} kun)
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ede9e1" />
              <XAxis
                dataKey="date"
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
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="activeStudents"
                name="Faol"
                stroke="#6d28d9"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="newStudents"
                name="Yangi"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
