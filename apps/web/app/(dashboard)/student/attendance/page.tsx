'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Clock, CalendarDays } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton } from '@/components/ui';

type AttendanceRecord = {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
};

const STATUS = {
  present: {
    label: "Keldi",
    icon: <CheckCircle2 size={14} />,
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  absent: {
    label: "Kelmadi",
    icon: <XCircle size={14} />,
    cls: 'bg-rose-50 text-rose-600 border-rose-200',
  },
  late: {
    label: "Kechikdi",
    icon: <Clock size={14} />,
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const months = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  } catch {
    return iso;
  }
}

function formatWeekday(iso: string) {
  const days = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
  try {
    return days[new Date(iso).getUTCDay()];
  } catch {
    return '';
  }
}

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    apiRequest<AttendanceRecord[]>(`/attendance/students/my-history?days=${days}`, {}, token)
      .then((r) => setRecords(r.data ?? []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [days]);

  const present = records.filter((r) => r.status === 'present').length;
  const late = records.filter((r) => r.status === 'late').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const total = records.length;
  const attendancePct = total === 0 ? 0 : Math.round(((present + late) * 100) / total);

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-8">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <Link href="/student/profile" className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Orqaga
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
              <CalendarDays size={18} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Davomatim</p>
              <p className="text-[#64748b] text-xs">So&apos;nggi {days} kun</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">
        {/* Period selector */}
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 flex gap-2">
          {[14, 30, 60].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-colors ${
                days === d
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-[#f7f4ef] text-[#64748b] hover:bg-[#ede9e1]'
              }`}
            >
              {d} kun
            </button>
          ))}
        </div>

        {/* Summary */}
        {!loading && total > 0 && (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-extrabold text-[#64748b] uppercase tracking-widest">Jami</p>
              <span className={`text-sm font-extrabold ${attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                {attendancePct}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#f7f4ef] rounded-full overflow-hidden mb-3">
              <div
                className={`h-2 rounded-full transition-all ${attendancePct >= 80 ? 'bg-emerald-500' : attendancePct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${attendancePct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-emerald-600 text-xl font-extrabold font-mono">{present}</p>
                <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-wider mt-0.5">Keldi</p>
              </div>
              <div className="border-x border-[#ede9e1]">
                <p className="text-amber-500 text-xl font-extrabold font-mono">{late}</p>
                <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-wider mt-0.5">Kechikdi</p>
              </div>
              <div>
                <p className="text-rose-500 text-xl font-extrabold font-mono">{absent}</p>
                <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-wider mt-0.5">Kelmadi</p>
              </div>
            </div>
          </div>
        )}

        {/* Records list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} theme="light" className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<CalendarDays size={28} />}
              title="Davomat ma'lumotlari yo'q"
              description="Tanlangan davr uchun davomat qayd etilmagan"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => {
              const s = STATUS[r.status] ?? STATUS.absent;
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-extrabold text-[#0f172a] text-sm">{formatDate(r.date)}</p>
                    <p className="text-[#94a3b8] text-[11px] mt-0.5">{formatWeekday(r.date)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border ${s.cls}`}>
                    {s.icon} {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
