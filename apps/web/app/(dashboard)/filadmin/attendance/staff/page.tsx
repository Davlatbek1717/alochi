'use client';
import { useEffect, useState } from 'react';
import { CalendarRange, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateNumeric, formatTime } from '@/lib/date-uz';

type Row = {
  id: string;
  date: string;
  isLate: boolean;
  lateMinutes: number;
  loginTime: string;
  user: { id: string; name: string };
};

function todayISO() { return new Date().toISOString().split('T')[0]; }
function daysAgoISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export default function StaffAttendanceHistoryPage() {
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let branchId = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
      branchId = u.branchId ?? '';
    } catch { /* ignore */ }
    if (!branchId) return;
    setLoading(true);
    apiRequest<Row[]>(
      `/attendance/staff?branchId=${branchId}&from=${from}&to=${to}`,
      {},
      token,
    )
      .then((res) => setRows(res.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div className="min-h-full bg-[#f7f4ef] p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarRange size={20} />
        <h1 className="text-xl font-bold text-[#0f172a]">Xodim davomat tarixi</h1>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-white border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-white border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
        />
      </div>
      {loading ? (
        <p className="text-[#64748b] text-sm">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <p className="text-[#64748b] text-sm">Maʼlumot yoʻq</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-3 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-[#0f172a] text-sm">{r.user.name}</p>
                <p className="text-xs text-[#64748b]">{formatDateNumeric(r.date)}</p>
              </div>
              <div className="text-right">
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
  );
}
