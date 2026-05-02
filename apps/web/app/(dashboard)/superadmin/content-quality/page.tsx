'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Play,
  Eye,
  Search,
  Filter as FilterIcon,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Sparkles,
  Users,
  Repeat,
  Star,
  X as XIcon,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

interface LessonStat {
  lessonId: string;
  title: string;
  passRate: number;
  totalStudents: number;
  feedbackAvg: number | null;
  feedbackCount: number;
  avgSessions: number;
}

interface ABResult {
  variant: string;
  students: number;
  passRate: number;
}

type StatusFilter = 'all' | 'ok' | 'warn' | 'critical';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'ok', label: 'Muvaffaqiyatli' },
  { key: 'warn', label: "O'rtacha" },
  { key: 'critical', label: 'Muammoli' },
];

/**
 * Pass-rate severity classifier following spec §21.1:
 *   ≥80%  → ok    (✅)
 *   50-79% → warn  (⚠️)
 *   <50%  → critical (🔴) — auto-flagged for replacement (§21.2)
 */
function severity(passRate: number): 'ok' | 'warn' | 'critical' {
  if (passRate >= 80) return 'ok';
  if (passRate >= 50) return 'warn';
  return 'critical';
}

const SEV_COPY = {
  ok: { label: "O'tdi", icon: '✅', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  warn: { label: "O'rtacha", icon: '⚠️', bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  critical: { label: 'Past', icon: '🔴', bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
} as const;

export default function ContentQualityPage() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [abResults, setAbResults] = useState<ABResult[] | null>(null);
  const [abLoading, setAbLoading] = useState(false);
  const toast = useToast();

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<LessonStat[]>('/content-quality/lessons', {}, token())
      .then((r) => setLessons(r.data ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Yuklab boʻlmadi'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function viewABResults(lessonId: string) {
    setSelectedLesson(lessonId);
    setAbLoading(true);
    setAbResults(null);
    try {
      const r = await apiRequest<ABResult[]>(
        `/content-quality/lessons/${lessonId}/ab-results`,
        {},
        token(),
      );
      setAbResults(r.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
      setAbResults([]);
    } finally {
      setAbLoading(false);
    }
  }

  async function startABTest(lessonId: string) {
    try {
      await apiRequest(
        `/content-quality/lessons/${lessonId}/variant`,
        {
          method: 'POST',
          body: JSON.stringify({ config: { description: 'B varianti' } }),
        },
        token(),
      );
      toast.success('B variant yaratildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    }
  }

  // ── Aggregates for the KPI hero + alerts banner ──
  const stats = useMemo(() => {
    const total = lessons.length;
    const enrolled = lessons.reduce((s, l) => s + l.totalStudents, 0);
    const weightedPass =
      enrolled > 0
        ? Math.round(
            lessons.reduce((s, l) => s + l.passRate * l.totalStudents, 0) /
              enrolled,
          )
        : 0;
    const critical = lessons.filter((l) => severity(l.passRate) === 'critical').length;
    const ok = lessons.filter((l) => severity(l.passRate) === 'ok').length;
    return { total, enrolled, weightedPass, critical, ok };
  }, [lessons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lessons
      .filter((l) => (q ? l.title.toLowerCase().includes(q) : true))
      .filter((l) => (filter === 'all' ? true : severity(l.passRate) === filter))
      .sort((a, b) => a.passRate - b.passRate); // worst first — actionable
  }, [lessons, search, filter]);

  const hasFilters = search.trim() !== '' || filter !== 'all';

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header — superadmin violet accent */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <BarChart2 size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-[11px] font-bold uppercase tracking-widest">
                Kontent sifati
              </p>
              <p className="text-white text-xl font-extrabold">Darslar samaradorligi</p>
              <p className="text-[#475569] text-[11px] font-bold mt-0.5">
                TZ §21.1 — har darsning real-time statistikasi
              </p>
            </div>
          </div>

          {/* KPI hero — 4 stat tiles */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl bg-[#162032]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <HeroTile icon={<BarChart2 size={14} />} value={stats.total} label="Darslar" tint="text-violet-400" />
              <HeroTile icon={<Users size={14} />} value={stats.enrolled} label="O'quvchilar" tint="text-blue-400" />
              <HeroTile icon={<CheckCircle2 size={14} />} value={`${stats.weightedPass}%`} label="O'rtacha o'tish" tint="text-emerald-400" />
              <HeroTile icon={<AlertTriangle size={14} />} value={stats.critical} label="Muammoli" tint="text-rose-400" />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-6 space-y-4">
        {/* Critical alert banner — §21.2 */}
        {!loading && stats.critical > 0 && (
          <div className="bg-rose-50 border-[1.5px] border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-rose-900">
                {stats.critical} ta dars 50% dan past — qayta ko&apos;rib chiqishni talab qiladi
              </p>
              <p className="text-xs font-bold text-rose-800/80 mt-0.5">
                Spec §21.2: dars o&apos;tish foizi 50% dan past bo&apos;lsa videoni almashtirish yoki
                darsni ikkiga bo&apos;lish tavsiya etiladi.
              </p>
            </div>
          </div>
        )}

        {/* Search + filter chips */}
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dars nomi bo'yicha qidirish..."
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-violet-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b]">
              <FilterIcon size={12} /> Filtr:
            </span>
            <div className="inline-flex bg-[#f7f4ef] border border-[#ede9e1] rounded-lg p-0.5">
              {STATUS_FILTERS.map((s) => {
                const count =
                  s.key === 'all'
                    ? lessons.length
                    : lessons.filter((l) => severity(l.passRate) === s.key).length;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setFilter(s.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      filter === s.key
                        ? 'bg-white text-[#0f172a] shadow-sm'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    {s.label}{' '}
                    <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
                className="ml-auto text-xs font-bold text-violet-600 hover:underline"
              >
                Tozalash
              </button>
            )}
          </div>
        </div>

        {/* Lessons list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} theme="light" className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<BarChart2 size={28} />}
              title={hasFilters ? 'Mos dars topilmadi' : "Hali dars yo'q"}
              description={
                hasFilters
                  ? "Filtrlarni o'zgartirib ko'ring"
                  : 'Statistika hisoblash uchun avval darslarni nashr qiling'
              }
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((lesson, idx) => (
              <LessonCard
                key={lesson.lessonId}
                rank={idx + 1}
                lesson={lesson}
                onABResults={() => viewABResults(lesson.lessonId)}
                onABStart={() => startABTest(lesson.lessonId)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* A/B results modal */}
      <Modal
        open={Boolean(selectedLesson)}
        onClose={() => {
          setSelectedLesson(null);
          setAbResults(null);
        }}
        title="A/B Test natijalari"
        size="lg"
        theme="light"
      >
        {abLoading ? (
          <p className="text-sm text-[#64748b] py-4 text-center">Yuklanmoqda...</p>
        ) : abResults && abResults.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {abResults.map((ab) => {
              const sev = severity(ab.passRate);
              const cfg = SEV_COPY[sev];
              return (
                <div
                  key={ab.variant}
                  className={`rounded-2xl border-[1.5px] ${cfg.border} ${cfg.bg} p-4`}
                >
                  <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-1">
                    Variant {ab.variant}
                  </p>
                  <p className={`text-3xl font-extrabold ${cfg.text} font-mono`}>
                    {ab.passRate}%
                  </p>
                  <p className="text-xs font-bold text-[#64748b] mt-1">
                    {ab.students} ta o&apos;quvchi sinadi
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[#94a3b8] py-4 text-center">
            Bu dars uchun A/B test yo&apos;q. &quot;A/B boshlash&quot; tugmasi orqali yaratish mumkin.
          </p>
        )}
      </Modal>
    </div>
  );
}

// ─── Hero tile ───────────────────────────────────────────────────────────────

interface HeroTileProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  tint: string;
}

function HeroTile({ icon, value, label, tint }: HeroTileProps) {
  return (
    <div className="bg-[#162032] border border-white/5 rounded-2xl p-3 flex flex-col gap-1">
      <span className={`${tint}`}>{icon}</span>
      <p className="text-white text-xl font-extrabold font-mono leading-none">{value}</p>
      <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ─── Lesson card ─────────────────────────────────────────────────────────────

interface LessonCardProps {
  rank: number;
  lesson: LessonStat;
  onABResults: () => void;
  onABStart: () => void;
}

/**
 * Per-lesson card. Pass-rate is the dominant signal so it sits big
 * with a traffic-light icon. Average sessions and feedback are
 * secondary chips. The "AI tavsiyasi" banner surfaces inside the card
 * when sessions exceed the spec's 2× threshold (§21.2 — "lesson too
 * hard, replace video or split"); it's a static heuristic for now,
 * the eventual ML-driven version is a Faza 3 item.
 */
function LessonCard({ rank, lesson, onABResults, onABStart }: LessonCardProps) {
  const sev = severity(lesson.passRate);
  const cfg = SEV_COPY[sev];

  // Heuristic flag: avgSessions > 2 hints students are repeating a
  // lot, which spec §21.2 calls out as "dars juda qiyin".
  const tooHard = lesson.avgSessions > 2;

  return (
    <li className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 hover:border-violet-300 transition-colors">
      <div className="flex items-start gap-3">
        {/* Rank chip */}
        <div className="w-9 h-9 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex flex-col items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-wider leading-none">
            #
          </span>
          <span className="text-xs font-extrabold text-[#0f172a] leading-none mt-0.5 font-mono">
            {rank}
          </span>
        </div>

        {/* Title + secondary chips */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-[#0f172a] truncate">{lesson.title}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]">
              <Users size={10} /> {lesson.totalStudents}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                tooHard
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'
              }`}
            >
              <Repeat size={10} /> {lesson.avgSessions.toFixed(1)} sessiya
            </span>
            {lesson.feedbackCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                <Star size={10} /> {(lesson.feedbackAvg ?? 0).toFixed(1)} ({lesson.feedbackCount})
              </span>
            )}
          </div>
        </div>

        {/* Pass rate dial */}
        <div className="text-right shrink-0">
          <p className={`text-2xl font-extrabold font-mono leading-none ${cfg.text}`}>
            {lesson.passRate}%
          </p>
          <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mt-1">
            {cfg.icon} {cfg.label}
          </p>
        </div>
      </div>

      {/* Pass rate bar */}
      <div className="mt-3 h-1.5 bg-[#f7f4ef] rounded-full overflow-hidden">
        <div
          className={`h-full ${cfg.bar} rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(2, lesson.passRate)}%` }}
        />
      </div>

      {/* AI suggestion — §21.2 */}
      {sev === 'critical' && (
        <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2">
          <Sparkles size={12} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-rose-800 leading-snug">
            AI tavsiyasi: pass rate juda past — videoni qayta ko&apos;rib chiqing yoki darsni
            ikkiga bo&apos;ling.
          </p>
        </div>
      )}
      {sev !== 'critical' && tooHard && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
          <TrendingDown size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-amber-800 leading-snug">
            O&apos;quvchilar bu darsni o&apos;rtacha 2 dan ortiq marta takrorlamoqda — dars juda
            qiyin bo&apos;lishi mumkin.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-[#f0ebe0] pt-3">
        <button
          type="button"
          onClick={onABResults}
          className="flex items-center gap-1.5 text-xs text-[#0f172a] bg-[#f7f4ef] hover:bg-[#ede9e1] border border-[#ede9e1] px-3 py-1.5 rounded-lg font-bold transition-colors"
        >
          <Eye size={12} /> A/B natijalar
        </button>
        <button
          type="button"
          onClick={onABStart}
          className="flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-lg font-bold transition-colors"
        >
          <Play size={12} /> A/B boshlash
        </button>
      </div>
    </li>
  );
}
