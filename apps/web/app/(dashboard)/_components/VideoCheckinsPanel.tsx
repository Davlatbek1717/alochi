'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Clock, CheckCircle, XCircle, Play, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { Skeleton } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type CheckinStatus = 'submitted' | 'missed' | 'pending';

export interface VideoCheckinRow {
  studentId: string;
  name: string;
  morning: CheckinStatus;
  evening: CheckinStatus;
  morningAt: string | null;
  eveningAt: string | null;
  morningCheckinId: string | null;
  eveningCheckinId: string | null;
  totalMissedDays: number;
}

interface VideoCheckinsPanelProps {
  branchId: string;
  /** Base path for per-student history link, e.g. "/filadmin/students" */
  studentBasePath?: string;
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
  onPlay: (checkinId: string, studentName: string, windowLabel: string) => void;
}) {
  if (status === 'submitted') {
    const time = formatTime(submittedAt);
    return (
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
          <CheckCircle size={13} className="shrink-0" />
          Tashladi{time ? ` (${time})` : ''}
        </span>
        {checkinId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(checkinId, studentName, windowLabel);
            }}
            aria-label={`${studentName} — ${windowLabel} videoni ko'rish`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0d9488]/10 text-[#0d9488] hover:bg-[#0d9488]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30"
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

function VideoPlayerModal({
  state,
  onClose,
}: {
  state: PlayerState;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
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
            <p className="text-sm font-extrabold text-[#0f172a]">{state.studentName}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">{state.windowLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="w-8 h-8 rounded-full bg-[#f7f4ef] hover:bg-[#ede9e1] text-[#64748b] flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-3 bg-black flex items-center justify-center min-h-[280px]">
          {state.loading && (
            <div className="text-white/70 text-sm font-semibold animate-pulse">
              Yuklanmoqda…
            </div>
          )}
          {state.error && (
            <div className="text-rose-300 text-sm font-semibold text-center px-4">
              {state.error}
            </div>
          )}
          {state.url && !state.loading && !state.error && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={state.url}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full rounded-xl"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MissedBadge({ count }: { count: number }) {
  if (count === 0) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">{count}</span>;
  }
  if (count <= 2) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{count}</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">{count}</span>;
}

export default function VideoCheckinsPanel({
  branchId,
  studentBasePath,
}: VideoCheckinsPanelProps) {
  const router = useRouter();
  const [rows, setRows] = useState<VideoCheckinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [player, setPlayer] = useState<PlayerState | null>(null);
  // Object URLs created for blob playback — revoked on cleanup so we
  // don't leak browser memory between successive plays.
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const u of objectUrlsRef.current) URL.revokeObjectURL(u);
      objectUrlsRef.current = [];
    };
  }, []);

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
        const res = await fetch(`${API_BASE}/video-checkins/${checkinId}/video`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg =
            body?.error?.message ?? body?.message ?? "Videoni yuklab bo'lmadi";
          setPlayer((p) =>
            p && p.checkinId === checkinId
              ? { ...p, loading: false, error: msg }
              : p,
          );
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        setPlayer((p) =>
          p && p.checkinId === checkinId
            ? { ...p, loading: false, url, error: '' }
            : p,
        );
      } catch {
        setPlayer((p) =>
          p && p.checkinId === checkinId
            ? { ...p, loading: false, error: "Internet aloqasini tekshiring" }
            : p,
        );
      }
    },
    [],
  );

  const closePlayer = useCallback(() => setPlayer(null), []);

  const load = useCallback(() => {
    if (!branchId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    apiRequest<VideoCheckinRow[]>(
      `/video-checkins/today?branchId=${encodeURIComponent(branchId)}`,
      {},
      token,
    )
      .then((res) => {
        setRows(res.data ?? []);
        setError('');
      })
      .catch(() => {
        setError("Ma'lumot yuklanmadi");
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['videocheckin:updated'], load);

  return (
    <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#ede9e1]">
        <div className="w-8 h-8 rounded-xl bg-[#f7f4ef] flex items-center justify-center">
          <Video size={16} className="text-[#0d9488]" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-[#0f172a]">Kunlik video tekshir</p>
          <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider">
            Ertalab 05:00–06:30 | Kechki 18:00–22:00
          </p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} theme="light" className="h-10 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center text-sm text-[#94a3b8]">{error}</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[#94a3b8]">
          Bu filialda faol o&apos;quvchilar yo&apos;q
        </div>
      ) : (
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
                <th className="text-left px-3 py-2 text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider">
                  30 kun (tashlamagan)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.studentId}
                  className={`border-t border-[#f7f4ef] transition-colors hover:bg-[#f7f4ef]/60 ${
                    studentBasePath ? 'cursor-pointer' : ''
                  } ${i % 2 === 0 ? '' : 'bg-[#fafaf9]'}`}
                  onClick={() => {
                    if (studentBasePath) {
                      router.push(`${studentBasePath}/${row.studentId}/video-history`);
                    }
                  }}
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
                  <td className="px-3 py-2.5">
                    <MissedBadge count={row.totalMissedDays} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {player && <VideoPlayerModal state={player} onClose={closePlayer} />}
    </div>
  );
}
