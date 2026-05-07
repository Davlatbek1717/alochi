'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ScanFace, CheckCircle, Clock, Key } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatTime } from '@/lib/date-uz';

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

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function FaceAttendancePage() {
  const router = useRouter();
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
      setError(err instanceof Error ? err.message : 'Tasdiqlashda xato');
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/filadmin')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
                <ScanFace size={18} className="text-[#0d9488]" />
              </div>
              <p className="text-white font-bold text-lg">Yuz ID davomat</p>
            </div>
            <input
              type="date"
              aria-label="Sana"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#0d9488]"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f7f4ef]" />
                  <div className="flex-1">
                    <div className="h-4 bg-[#f7f4ef] rounded w-1/3 mb-2" />
                    <div className="h-3 bg-[#f7f4ef] rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm">{error}</div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-10 text-center">
            <ScanFace size={32} className="text-[#94a3b8] mx-auto mb-3" />
            <p className="text-[#64748b] font-medium">Ushbu kun uchun ma&apos;lumot topilmadi</p>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">{records.length} ta xodim</p>
            {records.map((rec) => (
              <div key={rec.userId} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {getInitials(rec.staffName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[#0f172a] font-semibold text-sm">{rec.staffName}</p>
                      {rec.isLate && (
                        <span className="inline-flex items-center gap-1 bg-[#e11d48]/10 text-[#e11d48] text-xs px-2 py-0.5 rounded-full font-medium">
                          <Clock size={10} /> Kechikdi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[#64748b] text-xs font-mono">{formatTime(rec.checkInTime)}</span>
                      {rec.faceConfidence !== undefined ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium border border-blue-100">
                          <ScanFace size={10} /> Face ID · {Math.round(rec.faceConfidence * 100)}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-[#f7f4ef] text-[#64748b] text-xs px-2 py-0.5 rounded-full font-medium border border-[#ede9e1]">
                          <Key size={10} /> Qo&apos;lda
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleConfirm(rec.userId)}
                    disabled={rec.confirmed || confirming === rec.userId}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      rec.confirmed
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-not-allowed'
                        : 'bg-[#0f172a] text-white hover:bg-[#1e293b] disabled:opacity-50'
                    }`}
                  >
                    {rec.confirmed ? (
                      <span className="flex items-center gap-1"><CheckCircle size={12} /> Tasdiqlangan</span>
                    ) : confirming === rec.userId ? '...' : 'Tasdiqlash'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
