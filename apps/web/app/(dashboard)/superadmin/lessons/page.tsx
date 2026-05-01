'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, CheckCircle, Globe, Pencil, Trash2 } from 'lucide-react';
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
  { key: 'all', label: 'Hammasi', count: 500 },
  { key: 'worldview', label: 'Dunyoqarash (100)', count: 100 },
  { key: 'critical_thinking', label: 'Tanqidiy (50)', count: 50 },
  { key: 'skill_20', label: "Ko'nikma (50)", count: 50 },
  { key: 'experiment', label: 'Eksperiment (50)', count: 50 },
  { key: 'culture', label: 'Madaniyat', count: 0 },
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

export default function SuperadminLessonsPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
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

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
                <BookOpen size={18} className="text-[#0d9488]" />
              </div>
              <p className="text-white font-bold text-lg">Darslar</p>
            </div>
            <button
              onClick={() => router.push('/superadmin/lessons/new')}
              className="flex items-center gap-2 bg-[#0d9488] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors"
            >
              <Plus size={16} /> Yangi Dars
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 overflow-x-auto">
        <div className="flex gap-2 pb-1">
          {SUBCATEGORY_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? lessons.length
                : lessons.filter((l) => l.subcategory === tab.key).length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-[#0d9488] text-white border-[#0d9488]'
                    : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#f7f4ef]'
                }`}
              >
                {tab.label}{' '}
                <span
                  className={`ml-1 ${isActive ? 'text-white/80' : 'text-[#94a3b8]'}`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
                <Skeleton className="h-4 w-1/2 mb-2" theme="light" />
                <Skeleton className="h-3 w-1/4" theme="light" />
              </div>
            ))}
          </div>
        ) : (() => {
          const filteredLessons =
            activeTab === 'all'
              ? lessons
              : lessons.filter((l) => l.subcategory === activeTab);
          return filteredLessons.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<BookOpen size={28} />}
              title="Hali dars yo'q"
              description="Birinchi darsni yarating"
              theme="light"
              action={
                <button
                  onClick={() => router.push('/superadmin/lessons/new')}
                  className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
                >
                  Yangi Dars
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">{filteredLessons.length} ta dars</p>
            {filteredLessons.map((lesson) => (
              <div key={lesson.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold font-mono">{lesson.orderNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#0f172a] text-sm truncate">{lesson.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${TYPE_COLORS[lesson.type] ?? 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'}`}>
                          {TYPE_LABELS[lesson.type] ?? lesson.type}
                        </span>
                        <span className="text-xs text-[#94a3b8]">{lesson.nRepetitions}x takror</span>
                        <div className="flex gap-1">
                          {lesson.components.mcq && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-semibold">MCQ</span>}
                          {lesson.components.word_order && <span className="text-xs bg-violet-50 text-violet-600 border border-violet-100 px-1.5 py-0.5 rounded font-semibold">So&apos;z</span>}
                          {lesson.components.vocabulary && <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-semibold">Lug&apos;at</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${
                      lesson.isPublished
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {lesson.isPublished ? 'Nashr' : 'Qoralama'}
                    </span>
                    <div className="flex gap-2">
                      <Link
                        href={`/superadmin/lessons/${lesson.id}`}
                        className="flex items-center gap-1 text-xs text-[#0f172a] bg-[#f7f4ef] border border-[#ede9e1] px-2.5 py-1.5 rounded-lg font-semibold hover:bg-[#ede9e1] transition-colors"
                      >
                        <Pencil size={11} /> Tahrir
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(lesson)}
                        aria-label={`${lesson.title} darsini o'chirish`}
                        className="flex items-center gap-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                      {!lesson.isPublished && (
                        <button
                          onClick={() => publishLesson(lesson.id)}
                          disabled={publishing === lesson.id}
                          className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        >
                          <Globe size={11} /> {publishing === lesson.id ? '...' : 'Nashr'}
                        </button>
                      )}
                      {lesson.isPublished && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
        })()}
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
