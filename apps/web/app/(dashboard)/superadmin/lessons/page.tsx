'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Plus,
  CheckCircle,
  Globe,
  Pencil,
  Trash2,
  Search,
  X,
  Eye,
  Layers,
  Filter as FilterIcon,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  EmptyState,
  Skeleton,
  useToast,
  Modal,
} from '@/components/ui';

interface Lesson {
  id: string;
  title: string;
  type: string;
  orderNumber: number;
  subcategory?: string | null;
  orderInSubcategory?: number | null;
  youtubeUrl: string;
  nRepetitions: number;
  isPublished: boolean;
  components: Record<string, boolean>;
}

const SUBCATEGORY_TABS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'worldview', label: 'Dunyoqarash' },
  { key: 'critical_thinking', label: 'Tanqidiy' },
  { key: 'skill_20', label: "Ko'nikma" },
  { key: 'experiment', label: 'Eksperiment' },
  { key: 'culture', label: 'Madaniyat' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  english: 'Ingliz tili',
  personal_development: 'Shaxsiy rivojlanish',
  critical_thinking: 'Tanqidiy fikrlash',
  experiment: 'Tajriba',
};

const TYPE_COLORS: Record<string, string> = {
  english: 'bg-blue-50 text-blue-700 border-blue-100',
  personal_development: 'bg-violet-50 text-violet-700 border-violet-100',
  critical_thinking: 'bg-amber-50 text-amber-700 border-amber-100',
  experiment: 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/20',
};

type StatusFilter = 'all' | 'published' | 'draft';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'published', label: 'Nashr' },
  { key: 'draft', label: 'Qoralama' },
];

function countComponents(c: Record<string, boolean>): number {
  return Object.values(c).filter(Boolean).length;
}

export default function SuperadminLessonsPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((res) => setLessons(res.data))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${deleteTarget.id}`, { method: 'DELETE' }, token);
      setLessons((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success('Dars o’chirildi');
      setDeleteTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setDeleting(false);
    }
  }

  async function publishLesson(id: string) {
    setPublishing(id);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/publish`, { method: 'PATCH' }, token);
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, isPublished: true } : l));
      toast.success('Dars nashr qilindi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setPublishing(null);
    }
  }

  // Sub-category filter applies first; counts on the chips reflect the
  // currently-loaded list, NOT a hard-coded spec count.
  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: lessons.length };
    for (const l of lessons) {
      const k = l.subcategory ?? 'unset';
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lessons
      .filter((l) => activeTab === 'all' || l.subcategory === activeTab)
      .filter((l) => typeFilter === 'all' || l.type === typeFilter)
      .filter((l) =>
        statusFilter === 'all'
          ? true
          : statusFilter === 'published'
            ? l.isPublished
            : !l.isPublished,
      )
      .filter((l) => !q || l.title.toLowerCase().includes(q))
      .sort((a, b) => a.orderNumber - b.orderNumber);
  }, [lessons, activeTab, typeFilter, statusFilter, search]);

  const hasActiveFilters =
    search.trim() !== '' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    activeTab !== 'all';

  function clearFilters() {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setActiveTab('all');
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-[#0d9488]" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-lg leading-tight">Darslar</p>
                <p className="text-[#94a3b8] text-xs font-semibold truncate">
                  {lessons.length} ta dars · {lessons.filter((l) => l.isPublished).length} ta nashrda
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/superadmin/lessons/new')}
              className="flex items-center gap-2 bg-[#0d9488] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors shrink-0"
            >
              <Plus size={16} /> Yangi
            </button>
          </div>
        </div>
      </div>

      {/* Search + filters bar */}
      <div className="px-4 pt-4 space-y-3">
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dars nomi bo'yicha qidirish..."
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#0d9488]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters row — type + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#64748b] shrink-0">
              <FilterIcon size={12} />
              Filtr:
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Turi bo'yicha filtr"
              className="bg-[#f7f4ef] border border-[#ede9e1] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0f172a] focus:outline-none focus:border-[#0d9488]"
            >
              <option value="all">Hamma turlar</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="inline-flex bg-[#f7f4ef] border border-[#ede9e1] rounded-lg p-0.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    statusFilter === s.key
                      ? 'bg-white text-[#0f172a] shadow-sm'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs font-bold text-[#0d9488] hover:underline shrink-0"
              >
                Filtrlarni tozalash
              </button>
            )}
          </div>
        </div>

        {/* Subcategory tabs (English-track only — others have no subcategory) */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 pb-1 w-max">
            {SUBCATEGORY_TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? subcategoryCounts.all ?? 0
                  : subcategoryCounts[tab.key] ?? 0;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-[#0d9488] text-white border-[#0d9488]'
                      : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#f7f4ef]'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 ${isActive ? 'text-white/80' : 'text-[#94a3b8]'}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-6 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4">
                <Skeleton className="h-4 w-1/2 mb-2" theme="light" />
                <Skeleton className="h-3 w-1/4" theme="light" />
              </div>
            ))}
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<BookOpen size={28} />}
              title={
                hasActiveFilters
                  ? 'Mos dars topilmadi'
                  : "Hali dars yo'q"
              }
              description={
                hasActiveFilters
                  ? 'Qidiruv yoki filtrni o‘zgartirib ko‘ring'
                  : 'Birinchi darsni yarating'
              }
              theme="light"
              action={
                hasActiveFilters ? (
                  <button
                    onClick={clearFilters}
                    className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
                  >
                    Filtrlarni tozalash
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/superadmin/lessons/new')}
                    className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
                  >
                    Yangi Dars
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                {filteredLessons.length} ta dars
                {filteredLessons.length !== lessons.length && (
                  <span className="text-[#94a3b8] normal-case font-normal tracking-normal">
                    {' '}
                    / {lessons.length} dan
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-2">
              {filteredLessons.map((lesson) => {
                const compCount = countComponents(lesson.components);
                return (
                  <div
                    key={lesson.id}
                    className="group bg-white rounded-2xl border-[1.5px] border-[#ede9e1] hover:border-[#0d9488]/40 hover:shadow-sm transition-all"
                  >
                    {/* Main row — clickable surface to edit */}
                    <Link
                      href={`/superadmin/lessons/${lesson.id}`}
                      className="block p-4"
                    >
                      <div className="flex items-start gap-3">
                        {/* Order # badge */}
                        <div className="w-10 h-10 rounded-xl bg-[#0f172a] flex items-center justify-center shrink-0">
                          <span className="text-white text-sm font-bold font-mono">
                            {lesson.orderNumber}
                          </span>
                        </div>

                        {/* Title + chips */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#0f172a] text-sm leading-snug line-clamp-2">
                            {lesson.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                                TYPE_COLORS[lesson.type] ??
                                'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'
                              }`}
                            >
                              {TYPE_LABELS[lesson.type] ?? lesson.type}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                                lesson.isPublished
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {lesson.isPublished ? 'Nashr' : 'Qoralama'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]">
                              <Layers size={10} />
                              {compCount} blok
                            </span>
                            <span className="text-[11px] text-[#94a3b8] font-semibold">
                              {lesson.nRepetitions}× takror
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>

                    {/* Action bar — visible on hover/focus on desktop, always on mobile */}
                    <div className="px-4 pb-3 flex items-center gap-2 border-t border-[#f0ebe0] pt-2.5 mt-1">
                      <Link
                        href={`/superadmin/lessons/${lesson.id}`}
                        className="flex items-center gap-1.5 text-xs text-[#0f172a] bg-[#f7f4ef] hover:bg-[#ede9e1] border border-[#ede9e1] px-3 py-1.5 rounded-lg font-bold transition-colors"
                      >
                        <Pencil size={12} /> Tahrir
                      </Link>
                      <Link
                        href={`/student/lessons/${lesson.id}?preview=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-[#0f172a] bg-white hover:bg-[#f7f4ef] border border-[#ede9e1] px-3 py-1.5 rounded-lg font-bold transition-colors"
                        aria-label="Talaba ko'zi bilan ko'rish"
                      >
                        <Eye size={12} /> Ko‘rish
                      </Link>
                      {!lesson.isPublished && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            publishLesson(lesson.id);
                          }}
                          disabled={publishing === lesson.id}
                          className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 transition-colors"
                        >
                          <Globe size={12} />
                          {publishing === lesson.id ? '...' : 'Nashr'}
                        </button>
                      )}
                      {lesson.isPublished && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                          <CheckCircle size={12} /> Faol
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(lesson);
                        }}
                        aria-label={`${lesson.title} darsini o'chirish`}
                        className="ml-auto flex items-center gap-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Darsni o'chirish"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              O&apos;chirish
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{deleteTarget?.title}</span> darsini o&apos;chirmoqchimisiz? O&apos;quvchilar progressi mavjud bo&apos;lsa, o&apos;chirib bo&apos;lmaydi.
        </p>
      </Modal>
    </div>
  );
}
