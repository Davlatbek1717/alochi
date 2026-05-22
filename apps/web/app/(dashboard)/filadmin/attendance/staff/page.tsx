'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarRange, Clock, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken } from '@/lib/jwt';
import { formatDateNumeric, formatTime } from '@/lib/date-uz';
import { Skeleton, EmptyState } from '@/components/ui';

type Row = {
  id: string;
  date: string;
  isLate: boolean;
  lateMinutes: number;
  loginTime: string;
  user: { id: string; name: string };
};

const TASHKENT_MS = 5 * 60 * 60 * 1000;
function todayISO() {
  return new Date(Date.now() + TASHKENT_MS).toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  return new Date(Date.now() + TASHKENT_MS - n * 86_400_000).toISOString().slice(0, 10);
}

export default function StaffAttendanceHistoryPage() {
  const router = useRouter();
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const token = localStorage.getItem('accessToken') ?? '';
    let branchId = getBranchIdFromToken() ?? '';
    if (!branchId) {
      try {
        const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
        branchId = u.branchId ?? '';
      } catch { /* ignore */ }
    }
    if (!branchId) return;
    setLoading(true);
    setError(null);
    apiRequest<Row[]>(
      `/attendance/staff?branchId=${branchId}&from=${from}&to=${to}`,
      {},
      token,
    )
      .then((res) => setRows(res.data ?? []))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Dark header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/filadmin')}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center">
              <CalendarRange size={20} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filadmin</p>
              <p className="text-white text-lg font-bold">Xodim davomat tarixi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Date filters */}
        <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label
                htmlFor="staff-att-from"
                className="block text-xs font-semibold text-[#64748b] mb-1"
              >
                Boshlanish sanasi
              </label>
              <input
                id="staff-att-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Boshlanish sanasi"
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="staff-att-to"
                className="block text-xs font-semibold text-[#64748b] mb-1"
              >
                Tugash sanasi
              </label>
              <input
                id="staff-att-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Tugash sanasi"
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
              />
            </div>
          </div>
        </section>

        {error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-700">Xato yuz berdi</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={load}
              className="text-xs font-bold text-rose-700 hover:underline shrink-0"
            >
              Qayta urinish
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-[18px]" theme="light" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<CalendarRange size={28} />}
              title="Maʼlumot yoʻq"
              description="Tanlangan sana oraligʻida davomat qayd etilmagan"
              theme="light"
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#0f172a] text-sm truncate">{r.user.name}</p>
                  <p className="text-xs text-[#64748b]">{formatDateNumeric(r.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-[#0f172a] flex items-center gap-1 justify-end">
                    <Clock size={12} /> {formatTime(r.loginTime)}
                  </p>
                  {r.isLate && (
                    <p className="text-xs text-rose-600">+{r.lateMinutes} daq.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
