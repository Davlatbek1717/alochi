'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface StaffAttendanceRecord {
  id: string;
  userId: string;
  arrivalTime: string;
  method: 'face_auto' | 'manual' | string;
  isLate: boolean;
  isConfirmed: boolean;
  user: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  tenantId: string;
}

function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function FiladminAttendancePage() {
  const [date, setDate] = useState<string>(toISODateString(new Date()));
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  function fetchAttendance(selectedDate: string) {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken') ?? '';
    const user: User = JSON.parse(localStorage.getItem('user') ?? '{}');
    const branchId = user.tenantId ?? '';

    apiRequest<StaffAttendanceRecord[]>(
      `/attendance/staff/${branchId}/${selectedDate}`,
      {},
      token,
    )
      .then((res) => setRecords(res.data))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Xatolik yuz berdi');
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAttendance(date);
  }, [date]);

  async function handleConfirm(userId: string) {
    setConfirming(userId);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const user: User = JSON.parse(localStorage.getItem('user') ?? '{}');
      await apiRequest(
        `/attendance/staff/confirm/${userId}`,
        {
          method: 'POST',
          body: JSON.stringify({ confirmedBy: user.id, date }),
        },
        token,
      );
      setConfirmedIds((prev) => new Set([...prev, userId]));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setConfirming(null);
    }
  }

  function isConfirmed(record: StaffAttendanceRecord): boolean {
    return record.isConfirmed || confirmedIds.has(record.userId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Xodimlar Davomati</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 p-6">Yuklanmoqda...</div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-500 shadow-sm">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium">Bugun davomat yo&apos;q</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Xodim nomi
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Kelish vaqti
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Usul
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Tasdiqlash
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {record.user?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatTime(record.arrivalTime)}
                  </td>
                  <td className="px-4 py-3">
                    {record.method === 'face_auto' ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                        🤖 Face ID
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">
                        ✋ Qo&apos;lda
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.isLate ? (
                      <span className="inline-flex items-center gap-1 text-sm text-red-600 font-medium">
                        🔴 Kech
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-green-600 font-medium">
                        🟢 O&apos;z vaqtida
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleConfirm(record.userId)}
                      disabled={isConfirmed(record) || confirming === record.userId}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isConfirmed(record)
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                      }`}
                    >
                      {confirming === record.userId
                        ? '...'
                        : isConfirmed(record)
                        ? '✓ Tasdiqlangan'
                        : 'Tasdiqlash'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
