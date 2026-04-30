'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface TenantRow {
  tenantId: string;
  tenantName: string;
  dau: number;
  eventsLast30d: number;
}

export function ComparisonTab() {
  const [data, setData] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<TenantRow[]>('/analytics/comparison', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Markazlar Taqqoslash (faqat superadmin)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Markaz</th>
              <th className="text-center px-3 py-2 text-slate-400">DAU</th>
              <th className="text-center px-3 py-2 text-slate-400">Event&apos;lar (30 kun)</th>
            </tr>
          </thead>
          <tbody>
            {data
              .slice()
              .sort((a, b) => b.eventsLast30d - a.eventsLast30d)
              .map((t) => (
                <tr key={t.tenantId} className="border-b border-slate-700/50">
                  <td className="px-3 py-2 text-white font-medium">{t.tenantName}</td>
                  <td className="px-3 py-2 text-center text-emerald-400 font-semibold">{t.dau}</td>
                  <td className="px-3 py-2 text-center text-slate-300">{t.eventsLast30d}</td>
                </tr>
              ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500">Markazlar yo&apos;q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
