'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type CheckinStatus = 'submitted' | 'late' | 'missed' | 'pending';

interface Row {
  studentId: string;
  name: string;
  morning: CheckinStatus;
  evening: CheckinStatus;
  morningAt: string | null;
  eveningAt: string | null;
  morningCheckinId: string | null;
  eveningCheckinId: string | null;
}
interface Bucket {
  submitted: number;
  late: number;
  missed: number;
  pending: number;
}
interface MonitoringResp {
  date: string;
  isPast: boolean;
  scope: 'group' | 'branch' | 'tenant' | 'none';
  summary: { students: number; morning: Bucket; evening: Bucket };
  rows: Row[];
}

function tashkentToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
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

function StatusCell({
  status,
  submittedAt,
  checkinId,
  studentName,
  windowLabel,
  onPlay,
}: {
  status: CheckinStatus;
  submittedAt: string | null;
  checkinId: string | null;
  studentName: string;
  windowLabel: string;
  onPlay: (id: string, name: string, label: string) => void;
}) {
  if (status === 'submitted' || status === 'late') {
    const time = formatTime(submittedAt);
    const isLate = status === 'late';
    return (
      <div className="inline-flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 font-semibold text-xs ${
            isLate ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          <CheckCircle size={13} className="shrink-0" />
          {isLate ? 'Kechikdi' : 'Tashladi'}
          {time ? ` (${time})` : ''}
        </span>
        {checkinId && (
          <button
            type="button"
            onClick={() => onPlay(checkinId, studentName, windowLabel)}
            aria-label={`${studentName} — ${windowLabel} videoni ko'rish`}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
              isLate
                ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20'
                : 'bg-[#0d9488]/10 text-[#0d9488] hover:bg-[#0d9488]/20'
            }`}
          >
            <Play size={11} fill="currentColor" />
          </button>
        )}
      </div>
    );
  }
  if (status === 'missed') {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-xs">
        <XCircle size={13} className="shrink-0" />
        Tashlamadi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-xs">
      <Clock size={13} className="shrink-0" />
      Kutilmoqda
    </span>
  );
}

interface PlayerState {
  checkinId: string;
  studentName: string;
  windowLabel: string;
  url: string | null;
  loading: boolean;
  error: string;
}

function StatPill({
  label,
  bucket,
}: {
  label: string;
  bucket: Bucket;
}) {
  const cells: { k: keyof Bucket; t: string; c: string }[] = [
    { k: 'submitted', t: 'Tashladi', c: 'text-emerald-700' },
    { k: 'late', t: 'Kech', c: 'text-amber-700' },
    { k: 'missed', t: 'Yoʻq', c: 'text-rose-700' },
    { k: 'pending', t: 'Kutilmoqda', c: 'text-[#64748b]' },
  ];
  return (
    <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b] mb-1.5">
        {label}
      </p>
      <div className="grid grid-cols-4 gap-1 text-center">
        {cells.map((c) => (
          <div key={c.k}>
            <p className={`text-base font-extrabold ${c.c}`}>
              {bucket[c.k]}
            </p>
            <p className="text-[9px] font-bold text-[#94a3b8]">{c.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dedicated daily video-checkin monitoring board. Role-scoped on the
 * server (mentor → group, filadmin/manager → branch, superadmin →
 * tenant) via GET /video-checkins/monitoring?date=. Lets staff page
 * back through previous days and play any submitted video.
 */
export function VideoMonitoringBoard() {
  const [date, setDate] = useState(() => tashkentToday());
  const [data, setData] = useState<MonitoringResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const u of objectUrls.current) URL.revokeObjectURL(u);
      objectUrls.current = [];
    };
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<MonitoringResp>(
      `/video-checkins/monitoring?date=${date}`,
      {},
      token,
    )
      .then((r) => {
        setData(r.data);
        setError('');
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Ma'lumot yuklanmadi"),
      )
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const openPlayer = useCallback(
    async (checkinId: string, studentName: string, windowLabel: string) => {
      setPlayer({
        checkinId,
        studentName,
        windowLabel,
        url: null,
        loading: true,
        error: '',
      });
      try {
        const token = localStorage.getItem('accessToken') ?? '';
        const res = await fetch(
          `${API_BASE}/video-checkins/${checkinId}/video`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          setPlayer((p) =>
            p && p.checkinId === checkinId
              ? { ...p, loading: false, error: "Videoni yuklab bo'lmadi" }
              : p,
          );
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrls.current.push(url);
        setPlayer((p) =>
          p && p.checkinId === checkinId
            ? { ...p, loading: false, url, error: '' }
            : p,
        );
      } catch {
        setPlayer((p) =>
          p && p.checkinId === checkinId
            ? { ...p, loading: false, error: 'Internet aloqasini tekshiring' }
            : p,
        );
      }
    },
    [],
  );

  const isToday = date === tashkentToday();
  const rows = data?.rows ?? [];

  return (
    <div className="px-4 pt-5 pb-8 space-y-4 max-w-4xl mx-auto">
      {/* Date navigator */}
      <div className="bg-white border-[1.5px] border-[#ede9e1] rounded-2xl p-3 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Oldingi kun"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          className="p-2 rounded-xl hover:bg-[#f7f4ef] text-[#64748b]"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <input
            type="date"
            value={date}
            max={tashkentToday()}
            onChange={(e) =>
              e.target.value && setDate(e.target.value)
            }
            className="bg-transparent text-sm font-extrabold text-[#0f172a] text-center focus:outline-none"
            aria-label="Sana tanlang"
          />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
            {isToday ? 'Bugun' : data?.isPast ? 'Yakunlangan' : ''}
          </p>
        </div>
        <button
          type="button"
          aria-label="Keyingi kun"
          disabled={isToday}
          onClick={() => setDate((d) => shiftDate(d, 1))}
          className="p-2 rounded-xl hover:bg-[#f7f4ef] text-[#64748b] disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton theme="light" className="h-20 w-full rounded-xl" />
          <Skeleton theme="light" className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="bg-white border-[1.5px] border-[#ede9e1] rounded-2xl px-4 py-8 text-center text-sm text-rose-600 font-semibold">
          {error}
        </div>
      ) : data?.scope === 'none' ? (
        <div className="bg-white border-[1.5px] border-[#ede9e1] rounded-2xl px-4 py-8 text-center text-sm text-[#94a3b8]">
          Sizga biriktirilgan guruh/filial topilmadi.
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border-[1.5px] border-[#ede9e1] rounded-2xl px-4 py-8 text-center text-sm text-[#94a3b8]">
          Bu sanada faol o&apos;quvchilar yo&apos;q
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <StatPill label="Ertalab" bucket={data!.summary.morning} />
            <StatPill label="Kechqurun" bucket={data!.summary.evening} />
          </div>

          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#ede9e1]">
              <div className="w-8 h-8 rounded-xl bg-[#f7f4ef] flex items-center justify-center">
                <Video size={16} className="text-[#0d9488]" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#0f172a]">
                  Kunlik video monitoring
                </p>
                <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider">
                  {data!.summary.students} o&apos;quvchi · Ertalab 05:00–06:30
                  · Kechki 18:00–22:00
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f7f4ef]">
                    <th className="text-left px-4 py-2 text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider">
                      O&apos;quvchi
                    </th>
                    <th className="text-left px-3 py-2 text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider">
                      Ertalab
                    </th>
                    <th className="text-left px-3 py-2 text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider">
                      Kechki
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.studentId}
                      className={`border-t border-[#f7f4ef] ${
                        i % 2 === 0 ? '' : 'bg-[#fafaf9]'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-semibold text-[#0f172a] text-xs">
                        {row.name}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusCell
                          status={row.morning}
                          submittedAt={row.morningAt}
                          checkinId={row.morningCheckinId}
                          studentName={row.name}
                          windowLabel="Ertalabki video"
                          onPlay={openPlayer}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusCell
                          status={row.evening}
                          submittedAt={row.eveningAt}
                          checkinId={row.eveningCheckinId}
                          studentName={row.name}
                          windowLabel="Kechki video"
                          onPlay={openPlayer}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {player && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPlayer(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video"
        >
          <div
            className="relative bg-white rounded-2xl border-[1.5px] border-[#ede9e1] max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#ede9e1]">
              <div>
                <p className="text-sm font-extrabold text-[#0f172a]">
                  {player.studentName}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  {player.windowLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlayer(null)}
                aria-label="Yopish"
                className="w-8 h-8 rounded-full bg-[#f7f4ef] hover:bg-[#ede9e1] text-[#64748b] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3 bg-black flex items-center justify-center min-h-[280px]">
              {player.loading && (
                <div className="text-white/70 text-sm font-semibold animate-pulse">
                  Yuklanmoqda…
                </div>
              )}
              {player.error && (
                <div className="text-rose-300 text-sm font-semibold text-center px-4">
                  {player.error}
                </div>
              )}
              {player.url && !player.loading && !player.error && (
                <video
                  src={player.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[70vh] w-full rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
