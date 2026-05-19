'use client';
import { useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface ActivityResp {
  date: string;
  summary: {
    studyMinutes: number;
    morningVideo: 'submitted' | 'late' | 'missed' | 'none';
    eveningVideo: 'submitted' | 'late' | 'missed' | 'none';
  };
  events: { at: string; type: string; label: string }[];
  duels: {
    at: string;
    opponent: string;
    result: 'win' | 'loss' | 'draw';
    score: string;
  }[];
}

function fmtMin(mins: number): string {
  if (mins <= 0) return '0 daq';
  if (mins < 60) return `${mins} daq`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}s ${m}d` : `${h} soat`;
}

function clockHm(iso: string): string {
  // Render the timestamp in Tashkent local time (UTC+5, no DST).
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Tashkent calendar today (YYYY-MM-DD). */
function tashkentToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const base = new Date(`${dateStr}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

const VIDEO_BADGE: Record<
  ActivityResp['summary']['morningVideo'],
  { txt: string; cls: string }
> = {
  submitted: { txt: 'topshirdi', cls: 'bg-emerald-100 text-emerald-700' },
  late: { txt: 'kech', cls: 'bg-amber-100 text-amber-700' },
  missed: { txt: 'tashlamadi', cls: 'bg-rose-100 text-rose-700' },
  none: { txt: '—', cls: 'bg-[#f1ede5] text-[#94a3b8]' },
};

const DUEL_BADGE: Record<
  ActivityResp['duels'][number]['result'],
  { txt: string; cls: string }
> = {
  win: { txt: 'gʻalaba', cls: 'bg-emerald-100 text-emerald-700' },
  loss: { txt: 'magʻlubiyat', cls: 'bg-rose-100 text-rose-700' },
  draw: { txt: 'durang', cls: 'bg-[#f1ede5] text-[#64748b]' },
};

/**
 * Per-student daily activity timeline for staff student-detail pages
 * (filadmin / manager / mentor; superadmin tenant-wide). Reads the
 * role-scoped /study-time/student/:id/activity endpoint. Best-effort:
 * hides itself on error (e.g. out-of-scope 403) so it never breaks the
 * host page; an in-scope but quiet day shows an explicit empty state.
 */
export function StudentActivity({ studentId }: { studentId: string }) {
  const [date, setDate] = useState(() => tashkentToday());
  const [data, setData] = useState<ActivityResp | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'hidden'>('loading');

  useEffect(() => {
    if (!studentId) {
      setState('hidden');
      return;
    }
    let cancelled = false;
    setState((s) => (s === 'hidden' ? s : 'loading'));
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ActivityResp>(
      `/study-time/student/${studentId}/activity?date=${date}`,
      {},
      token,
    )
      .then((r) => {
        if (cancelled) return;
        setData(r.data);
        setState('ok');
      })
      .catch(() => {
        if (!cancelled) setState('hidden');
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, date]);

  if (state === 'hidden') return null;

  const isToday = date === tashkentToday();
  const merged = data
    ? [
        ...data.events.map((e) => ({
          at: e.at,
          label: e.label,
          kind: 'event' as const,
        })),
        ...data.duels.map((d) => ({
          at: d.at,
          label: `⚔️ Duel — ${d.opponent} (${d.score})`,
          kind: 'duel' as const,
          result: d.result,
        })),
      ].sort((a, b) => a.at.localeCompare(b.at))
    : [];

  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={15} className="text-violet-500 shrink-0" />
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748b] truncate">
            Kunlik faoliyat
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Oldingi kun"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="p-1 rounded-lg hover:bg-[#f7f4ef] text-[#64748b]"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-extrabold text-[#0f172a] tabular-nums">
            {isToday ? 'Bugun' : date}
          </span>
          <button
            type="button"
            aria-label="Keyingi kun"
            disabled={isToday}
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="p-1 rounded-lg hover:bg-[#f7f4ef] text-[#64748b] disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {state === 'loading' || !data ? (
        <div className="h-28 animate-pulse bg-[#f7f4ef] rounded-xl" />
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-2 py-2 text-center">
              <p className="text-sm font-extrabold text-[#0f172a]">
                {fmtMin(data.summary.studyMinutes)}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748b]">
                O&apos;quv vaqti
              </p>
            </div>
            {(['morningVideo', 'eveningVideo'] as const).map((k) => {
              const b = VIDEO_BADGE[data.summary[k]];
              return (
                <div
                  key={k}
                  className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-2 py-2 text-center"
                >
                  <span
                    className={`inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-full ${b.cls}`}
                  >
                    {b.txt}
                  </span>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748b] mt-1">
                    {k === 'morningVideo' ? 'Ertalab video' : 'Kechqurun video'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Timeline */}
          {merged.length === 0 ? (
            <p className="text-xs text-[#94a3b8] text-center py-4">
              Bu kunda qayd etilgan faoliyat yo&apos;q
            </p>
          ) : (
            <ul className="space-y-1.5">
              {merged.map((m, i) => (
                <li
                  key={`${m.at}-${i}`}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <span className="text-[11px] font-bold text-[#94a3b8] tabular-nums mt-0.5 w-10 shrink-0">
                    {clockHm(m.at)}
                  </span>
                  <span className="flex-1 min-w-0 font-medium text-[#0f172a]">
                    {m.label}
                    {m.kind === 'duel' && (
                      <span
                        className={`ml-1.5 inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-full align-middle ${DUEL_BADGE[m.result].cls}`}
                      >
                        {DUEL_BADGE[m.result].txt}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
