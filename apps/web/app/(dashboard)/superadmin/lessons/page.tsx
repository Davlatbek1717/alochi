'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, CheckCircle, Globe, Pencil } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  type: string;
  orderNumber: number;
  youtubeUrl: string;
  nRepetitions: number;
  isPublished: boolean;
  components: Record<string, boolean>;
}

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
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((res) => setLessons(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function publishLesson(id: string) {
    setPublishing(id);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/publish`, { method: 'PATCH' }, token);
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, isPublished: true } : l));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik');
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

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3">
        {error && (
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 animate-pulse">
                <div className="h-4 bg-[#f7f4ef] rounded w-1/2 mb-2" />
                <div className="h-3 bg-[#f7f4ef] rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-10 text-center">
            <BookOpen size={32} className="text-[#94a3b8] mx-auto mb-3" />
            <p className="text-[#64748b] font-semibold">Hali dars yo&apos;q</p>
            <p className="text-[#94a3b8] text-sm mt-1">Birinchi darsni yarating</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">{lessons.length} ta dars</p>
            {lessons.map((lesson) => (
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
        )}
      </div>
    </div>
  );
}
