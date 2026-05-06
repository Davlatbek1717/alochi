'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  CheckCircle,
  Search,
  X as XIcon,
  Filter as FilterIcon,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast, Modal } from '@/components/ui';

interface ExamRow {
  id: string;
  title: string;
  description: string | null;
  passThreshold: number;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  createdAt: string;
  _count: { questions: number };
}

type StatusFilter = 'all' | 'published' | 'draft';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'published', label: 'Nashr' },
  { key: 'draft', label: 'Qoralama' },
];

export default function SuperadminExamsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<ExamRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ExamRow[]>('/exams/admin', {}, token)
      .then((r) => setExams(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Yuklab boʻlmadi'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/exams/admin/${deleteTarget.id}`, { method: 'DELETE' }, token);
      setExams((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast.success("Imtihon o'chirildi");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams
      .filter((e) =>
        statusFilter === 'all'
          ? true
          : statusFilter === 'published'
            ? e.isPublished
            : !e.isPublished,
      )
      .filter((e) => !q || e.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [exams, statusFilter, search]);

  const hasFilters = search.trim() !== '' || statusFilter !== 'all';

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
              <GraduationCap size={18} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">Imtihonlar</p>
              <p className="text-[#94a3b8] text-xs font-semibold">
                {exams.length} ta imtihon ·{' '}
                {exams.filter((e) => e.isPublished).length} ta nashrda
              </p>
            </div>
          </div>
          <Link
            href="/superadmin/exams/new"
            className="flex items-center gap-2 bg-[#0d9488] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors shrink-0"
          >
            <Plus size={16} /> Yangi imtihon
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pt-4 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Imtihon nomi bo'yicha qidirish..."
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#0d9488]"
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
            {hasFilters && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
                className="ml-auto text-xs font-bold text-[#0d9488] hover:underline shrink-0"
              >
                Tozalash
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-6 space-y-2 max-w-5xl mx-auto">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} theme="light" className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<GraduationCap size={28} />}
              title={hasFilters ? 'Mos imtihon topilmadi' : "Hali imtihon yo'q"}
              description={
                hasFilters
                  ? "Filtrlarni o'zgartirib ko'ring"
                  : 'Birinchi imtihonni yarating'
              }
              action={
                hasFilters ? null : (
                  <Link
                    href="/superadmin/exams/new"
                    className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2"
                  >
                    <Plus size={16} /> Yangi imtihon
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest px-1">
              {filtered.length} ta imtihon
              {filtered.length !== exams.length && (
                <span className="text-[#94a3b8] normal-case font-normal tracking-normal">
                  {' '}
                  / {exams.length} dan
                </span>
              )}
            </p>
            {filtered.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onDelete={() => setDeleteTarget(exam)}
              />
            ))}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Imtihonni o'chirish"
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
              className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              O&apos;chirish
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">
            {deleteTarget?.title}
          </span>{' '}
          imtihonini o&apos;chirmoqchimisiz? Savollar ham birga o&apos;chiriladi.
        </p>
      </Modal>
    </div>
  );
}

function ExamCard({
  exam,
  onDelete,
}: {
  exam: ExamRow;
  onDelete: () => void;
}) {
  const noQuestions = exam._count.questions === 0;
  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] hover:border-[#0d9488]/40 hover:shadow-sm transition-all">
      <Link href={`/superadmin/exams/${exam.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#0f172a] text-sm leading-snug">
              {exam.title}
            </p>
            {exam.description && (
              <p className="text-xs text-[#64748b] font-semibold mt-1 line-clamp-2 leading-snug">
                {exam.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                  exam.isPublished
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {exam.isPublished ? 'Nashr' : 'Qoralama'}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                  noQuestions
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'
                }`}
              >
                {noQuestions ? <AlertTriangle size={10} /> : <ListChecks size={10} />}
                {exam._count.questions} ta savol
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]">
                <CheckCircle size={10} />
                {exam.passThreshold}% o&apos;tish
              </span>
              {exam.timeLimitMinutes && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]">
                  <Clock size={10} />
                  {exam.timeLimitMinutes} daq.
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="px-4 pb-3 flex items-center gap-2 border-t border-[#f0ebe0] pt-2.5">
        <Link
          href={`/superadmin/exams/${exam.id}`}
          className="flex items-center gap-1.5 text-xs text-[#0f172a] bg-[#f7f4ef] hover:bg-[#ede9e1] border border-[#ede9e1] px-3 py-1.5 rounded-lg font-bold transition-colors"
        >
          <Pencil size={12} /> Tahrir
        </Link>
        <button
          onClick={onDelete}
          aria-label={`${exam.title} imtihonini o'chirish`}
          className="ml-auto flex items-center gap-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
