'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

type StaffRecord = {
  id: string;
  userId: string;
  loginTime: string | null;
  isLate: boolean;
  recognitionMethod: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  user: { id: string; name: string };
};

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return typeof payload.branchId === 'string' ? payload.branchId : null;
  } catch {
    return null;
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function lateMinutes(loginTime: string | null): number {
  if (!loginTime) return 0;
  const login = new Date(loginTime);
  const cutoff = new Date(login);
  cutoff.setHours(9, 0, 0, 0);
  return Math.max(0, Math.round((login.getTime() - cutoff.getTime()) / 60000));
}

function methodBadge(method: string | null) {
  if (method === 'face_auto') {
    return (
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
        👁 Yuz
      </span>
    );
  }
  if (method === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">
        🔑 Qo&apos;lda
      </span>
    );
  }
  if (method === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full font-medium">
        👤 Admin
      </span>
    );
  }
  return <span className="text-gray-400">—</span>;
}

function exportCsv(records: StaffRecord[], date: string) {
  const header = ['Xodim', 'Kirish vaqti', 'Usul', 'Kechikish', 'Tasdiqlangan'];
  const rows = records.map((r) => [
    r.user.name,
    formatTime(r.loginTime),
    r.recognitionMethod ?? '—',
    r.isLate ? `+${lateMinutes(r.loginTime)} daq` : "O'z vaqtida",
    r.confirmedAt ? formatTime(r.confirmedAt) : "Yo'q",
  ]);
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TODAY = new Date().toISOString().split('T')[0];

export default function FiladminAttendancePage() {
  const [date, setDate] = useState(TODAY);
  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const branchId = getBranchIdFromToken();

  const loadRecords = useCallback(
    async (selectedDate: string) => {
      if (!branchId) return;
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('accessToken') ?? '';
        const res = await apiRequest<StaffRecord[]>(
          `/attendance/staff/${branchId}/${selectedDate}`,
          {},
          token,
        );
        setRecords(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
      } finally {
        setLoading(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    loadRecords(date);
  }, [date, loadRecords]);

  async function confirmStaff(userId: string) {
    setConfirming(userId);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        `/attendance/staff/confirm/${userId}`,
        { method: 'POST', body: JSON.stringify({ date }) },
        token,
      );
      setRecords((prev) =>
        prev.map((r) =>
          r.userId === userId ? { ...r, confirmedAt: new Date().toISOString() } : r,
        ),
      );
    } catch {
      // user can retry
    } finally {
      setConfirming(null);
    }
  }

  if (!branchId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Xodimlar Davomati</h1>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-red-500">Filial topilmadi. Administrator bilan bog&#39;laning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Xodimlar Davomati</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={TODAY}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {records.length > 0 && (
            <button
              onClick={() => exportCsv(records, date)}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              📥 Eksport
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => loadRecords(date)} className="ml-4 underline text-sm font-medium">
            Qayta urinish
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Xodim', 'Kirish', 'Usul', 'Kechikish', 'Tasdiqlangan'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-t border-gray-100">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : records.length === 0 && !error ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-500 shadow-sm">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium">Bu kun uchun davomat yo&apos;q</p>
        </div>
      ) : !error ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Xodim', 'Kirish', 'Usul', 'Kechikish', 'Tasdiqlangan'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatTime(r.loginTime)}</td>
                  <td className="px-4 py-3">{methodBadge(r.recognitionMethod)}</td>
                  <td className="px-4 py-3">
                    {!r.loginTime ? (
                      <span className="text-gray-400">—</span>
                    ) : r.isLate ? (
                      <span className="text-red-600 font-medium">⏰ +{lateMinutes(r.loginTime)} daq</span>
                    ) : (
                      <span className="text-green-600 font-medium">✅ O&apos;z vaqtida</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!r.loginTime ? (
                      <span className="text-gray-400">Kelmagan</span>
                    ) : r.confirmedAt ? (
                      <span className="text-green-600 font-medium">✓ {formatTime(r.confirmedAt)}</span>
                    ) : (
                      <button
                        onClick={() => confirmStaff(r.userId)}
                        disabled={confirming === r.userId}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {confirming === r.userId ? '...' : 'Tasdiqlash'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
