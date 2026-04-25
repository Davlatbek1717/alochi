'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type AttendanceRecord = {
  userId: string;
  staffName: string;
  checkInTime: string;
  faceConfidence?: number;
  isLate: boolean;
  confirmed: boolean;
};

type LocalUser = {
  id: string;
  role: string;
  name: string;
  branchId: string;
  tenantId: string;
};

function todayDateString() {
  return new Date().toISOString().split('T')[0];
}

export default function FaceAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAttendance() {
      setLoading(true);
      setError('');
      try {
        const rawUser = localStorage.getItem('user');
        if (!rawUser) throw new Error("Foydalanuvchi ma'lumotlari topilmadi");
        const user: LocalUser = JSON.parse(rawUser);
        const token = localStorage.getItem('accessToken') ?? '';
        const res = await apiRequest<AttendanceRecord[]>(
          `/attendance/staff/${user.branchId}/${date}`,
          {},
          token,
        );
        setRecords(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Xato yuz berdi');
      } finally {
        setLoading(false);
      }
    }

    fetchAttendance();
  }, [date]);

  async function handleConfirm(userId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setConfirming(userId);
    try {
      await apiRequest(`/attendance/staff/confirm/${userId}`, {
        method: 'POST',
      }, token);
      setRecords((prev) =>
        prev.map((r) => r.userId === userId ? { ...r, confirmed: true } : r)
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Tasdiqlashda xato');
    } finally {
      setConfirming(null);
    }
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">Yuz ID davomat</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <p className="text-gray-500">Yuklanmoqda...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-left">
                <th className="px-4 py-3 font-medium">Xodim ismi</th>
                <th className="px-4 py-3 font-medium">Kirish vaqti</th>
                <th className="px-4 py-3 font-medium">Usul</th>
                <th className="px-4 py-3 font-medium">Kechikdi?</th>
                <th className="px-4 py-3 font-medium">Ishonch (%)</th>
                <th className="px-4 py-3 font-medium">Amal</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Ushbu kun uchun ma&apos;lumot topilmadi
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.userId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{rec.staffName}</td>
                    <td className="px-4 py-3 text-gray-600">{formatTime(rec.checkInTime)}</td>
                    <td className="px-4 py-3">
                      {rec.faceConfidence !== undefined ? (
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          Face ID
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">
                          Qo&apos;lda
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rec.isLate ? (
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
                          Kechikdi
                        </span>
                      ) : (
                        <span className="text-green-500 text-xs">✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {rec.faceConfidence !== undefined
                        ? `${Math.round(rec.faceConfidence * 100)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleConfirm(rec.userId)}
                        disabled={rec.confirmed || confirming === rec.userId}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          rec.confirmed
                            ? 'bg-green-100 text-green-600 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                        }`}
                      >
                        {rec.confirmed ? 'Tasdiqlangan' : confirming === rec.userId ? '...' : 'Tasdiqlash'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
