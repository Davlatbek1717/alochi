'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  PlayCircle,
  CheckCircle,
  ArrowLeft,
  Search,
  X as XIcon,
  CalendarDays,
  AlertCircle,
  User,
  Star,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { tashkentToday } from '@/lib/tashkent-date';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';
import { formatDateShort } from '@/lib/date-uz';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  kpiBall: number;
  deadline?: string;
  creator?: { name: string };
};

const STATUS_LABEL: Record<string, string> = {
  sent: 'Yuborildi',
  seen: "Ko'rildi",
  in_progress: 'Jarayonda',
  done: 'Bajarildi',
  confirmed: 'Tasdiqlandi',
};

const STATUS_BADGE: Record<string, string> = {
  sent: 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]',
  seen: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  confirmed: 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/20',
};

const NEXT_STATUS: Record<string, string | null> = {
  sent: 'in_progress',
  seen: 'in_progress',
  in_progress: 'done',
  done: null,
  confirmed: null,
};

type FilterMode = 'all' | 'pending' | 'done';

export default function TesterTasksPage() {
  const { success, error: toastError } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  // A9: per-task pending set to prevent double-submit
  const [pendingTasks, setPendingTaskIds] = useState<Set<string>>(new Set());

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  // A2: move TODAY inside component using tashkentToday()
  const TODAY = tashkentToday();

  useEffect(() => {
    apiRequest<Task[]>('/tasks/my', {}, token())
      .then((res) => setTasks(res.data))
      .catch(() => {
        setLoadError(true);
        toastError("Vazifalar yuklanmadi — qayta urinib ko'ring");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, status: string) {
    if (pendingTasks.has(id)) return;
    setPendingTaskIds((prev) => new Set(prev).add(id));
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token());
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
      success('Status yangilandi');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xato');
    } finally {
      setPendingTaskIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  const counts = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== 'done' && t.status !== 'confirmed').length;
    const done = tasks.length - pending;
    return { all: tasks.length, pending, done };
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      const isPending = t.status !== 'done' && t.status !== 'confirmed';
      if (filter === 'pending' && !isPending) return false;
      if (filter === 'done' && isPending) return false;
      return true;
    });
  }, [tasks, search, filter]);

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-10">
      {/* Header — dark navy + amber radial accent (staff theme) */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <Link
              href="/tester"
              aria-label="Orqaga"
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">Tester</p>
              <p className="text-white text-lg font-extrabold leading-tight">Vazifalar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3 max-w-lg mx-auto">
        {/* Search + filter chips — shown only when tasks exist */}
        {!loading && tasks.length > 0 && (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Vazifa nomi bo'yicha qidirish..."
                className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-amber-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Qidiruvni tozalash"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
              {(
                [
                  { key: 'all', label: 'Hammasi', count: counts.all },
                  { key: 'pending', label: 'Kutilmoqda', count: counts.pending },
                  { key: 'done', label: 'Bajarilgan', count: counts.done },
                ] as { key: FilterMode; label: string; count: number }[]
              ).map((f) => {
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-[#0f172a] text-white border-[#0f172a]'
                        : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#fffaf0]'
                    }`}
                  >
                    {f.label}
                    <span className={isActive ? 'text-white/80' : 'text-[#94a3b8]'}>{f.count}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* A5: load error retry card */}
        {loadError && !loading && (
          <div className="bg-rose-50 border-[1.5px] border-rose-200 rounded-2xl px-4 py-3">
            <p className="text-rose-700 text-sm font-bold">
              Vazifalar yuklanmadi. Sahifani yangilang yoki qayta urinib ko&apos;ring.
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-2">
                <Skeleton theme="light" className="h-4 w-2/3" />
                <Skeleton theme="light" className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<ClipboardList size={28} />}
              title="Vazifalar yo'q"
              description="Sizga hali vazifalar yuklanmagan"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-sm font-extrabold text-[#0f172a]">Filtrga mos vazifa topilmadi</p>
            <p className="text-xs text-[#64748b] mt-1">Qidiruv yoki filtrni o&apos;zgartiring</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((t) => {
              const next = NEXT_STATUS[t.status];
              const isOverdue = t.deadline && t.deadline < TODAY && t.status !== 'done' && t.status !== 'confirmed';
              return (
                <li key={t.id} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-2.5">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="font-extrabold text-[#0f172a] text-sm flex-1 leading-snug">{t.title}</p>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${STATUS_BADGE[t.status] ?? STATUS_BADGE.sent}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>

                  {t.description && (
                    <p className="text-xs text-[#64748b] leading-relaxed">{t.description}</p>
                  )}

                  <div className="flex items-center justify-between gap-2 text-[11px] flex-wrap">
                    <div className="flex items-center gap-3">
                      {t.creator?.name && (
                        <span className="inline-flex items-center gap-1 text-[#64748b] font-bold">
                          <User size={11} />
                          {t.creator.name}
                        </span>
                      )}
                      {t.deadline && (
                        <span className={`inline-flex items-center gap-1 font-bold ${isOverdue ? 'text-rose-600' : 'text-[#64748b]'}`}>
                          <CalendarDays size={11} />
                          {formatDateShort(t.deadline)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-extrabold text-[10px]">
                          <AlertCircle size={10} /> Muddati o&apos;tgan
                        </span>
                      )}
                      {t.kpiBall > 0 && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-extrabold">
                          <Star size={10} />
                          {t.kpiBall} KPI
                        </span>
                      )}
                    </div>
                  </div>

                  {next && (
                    <Button
                      variant={next === 'done' ? 'success' : 'secondary'}
                      fullWidth
                      size="sm"
                      disabled={pendingTasks.has(t.id)}
                      icon={next === 'done' ? <CheckCircle size={14} /> : <PlayCircle size={14} />}
                      onClick={() => updateStatus(t.id, next)}
                    >
                      {pendingTasks.has(t.id) ? 'Saqlanmoqda...' : next === 'done' ? 'Bajarildi' : 'Boshlash'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
