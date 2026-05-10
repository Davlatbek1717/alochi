'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Video, CheckCircle, XCircle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton } from '@/components/ui';

interface HistoryRow {
  date: string;
  morning: string | null;
  evening: string | null;
  morningSubmittedAt: string | null;
  eveningSubmittedAt: string | null;
}

function StatusDot({ status }: { status: string | null }) {
  if (!status) return <span className="text-[#cbd5e1] text-xs">—</span>;
  if (status === 'submitted')
    return <CheckCircle size={14} className="text-emerald-500 shrink-0" />;
  if (status === 'missed')
    return <XCircle size={14} className="text-rose-500 shrink-0" />;
  return <Clock size={14} className="text-amber-500 shrink-0" />;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tashkent',
    });
  } catch {
    return '';
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('uz-UZ', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  } catch {
    return dateStr;
  }
}

export default function StudentVideoHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [missedCount, setMissedCount] = useState(0);

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<HistoryRow[]>(
        `/video-checkins/student/${studentId}/history?days=30`,
        {},
        token,
      ).catch(() => ({ data: [] as HistoryRow[] })),
      apiRequest<{ count: number }>(
        `/video-checkins/student/${studentId}/missed-count?since=30`,
        {},
        token,
      ).catch(() => ({ data: { count: 0 } })),
      apiRequest<{ name: string }>(
        `/users/${studentId}`,
        {},
        token,
      ).catch(() => ({ data: { name: '' } })),
    ]).then(([histRes, missedRes, userRes]) => {
      setRows((histRes.data as HistoryRow[]) ?? []);
      setMissedCount((missedRes.data as { count: number })?.count ?? 0);
      setStudentName((userRes.data as { name: string })?.name ?? '');
    }).finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
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
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#94a3b8] text-sm mb-4"
          >
            <ArrowLeft size={16} />
            Orqaga
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center shrink-0">
              <Video size={20} className="text-[#0d9488]" />
            </div>
            <div className="flex-1 min-w-0">
              {loading && !studentName ? (
                <Skeleton className="h-5 w-40 bg-white/10 mb-1" />
              ) : (
                <p className="text-white text-base font-extrabold truncate">
                  {studentName || "O'quvchi"} — Video tarixi
                </p>
              )}
              <p className="text-[#94a3b8] text-xs">
                Oxirgi 30 kun • {missedCount} ta o&apos;tkazilgan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-8 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} theme="light" className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<Video size={28} />}
              title="Hali video tarix yo'q"
              description="O'quvchi hali video topshirmagan"
            />
          </div>
        ) : (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <div className="overflow-x-auto">
            <div className="grid grid-cols-[1fr_auto_auto] bg-[#f7f4ef] px-4 py-2 gap-4">
              <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider">Sana</span>
              <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider w-20 text-center">Ertalab</span>
              <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider w-20 text-center">Kechki</span>
            </div>
            {rows.map((row, i) => (
              <div
                key={row.date}
                className={`grid grid-cols-[1fr_auto_auto] px-4 py-3 gap-4 items-center border-t border-[#f7f4ef] ${
                  i % 2 !== 0 ? 'bg-[#fafaf9]' : ''
                }`}
              >
                <span className="text-xs font-semibold text-[#0f172a]">
                  {formatDate(row.date)}
                </span>
                <div className="w-20 flex flex-col items-center gap-0.5">
                  <StatusDot status={row.morning} />
                  {row.morning === 'submitted' && row.morningSubmittedAt && (
                    <span className="text-[9px] text-[#94a3b8] font-semibold">
                      {formatTime(row.morningSubmittedAt)}
                    </span>
                  )}
                </div>
                <div className="w-20 flex flex-col items-center gap-0.5">
                  <StatusDot status={row.evening} />
                  {row.evening === 'submitted' && row.eveningSubmittedAt && (
                    <span className="text-[9px] text-[#94a3b8] font-semibold">
                      {formatTime(row.eveningSubmittedAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-1 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <CheckCircle size={12} className="text-emerald-500" /> Tashladi
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <XCircle size={12} className="text-rose-500" /> Tashlamadi
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <span className="text-[#cbd5e1]">—</span> Ma&apos;lumot yo&apos;q
          </div>
        </div>
      </div>
    </div>
  );
}
