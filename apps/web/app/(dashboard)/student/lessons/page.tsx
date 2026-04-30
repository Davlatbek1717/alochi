'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Lock, CheckCircle, BookMarked } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton } from '@/components/ui';

type Lesson = {
  id: string;
  title: string;
  orderNumber: number;
  isPublished: boolean;
};

type Progress = {
  lessonId: string;
  sessionCount: number;
  homeCompleted: boolean;
  academyCompleted: boolean;
};

export default function LessonsListPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    async function load() {
      try {
        const [lessonsRes, progressRes] = await Promise.all([
          apiRequest<Lesson[]>('/lessons', {}, token),
          apiRequest<Progress[]>('/progress/my', {}, token),
        ]);
        setLessons(lessonsRes.data.filter((l) => l.isPublished));
        const progressMap: Record<string, Progress> = {};
        for (const p of progressRes.data) progressMap[p.lessonId] = p;
        setProgress(progressMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Xato yuz berdi');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getStatus(lesson: Lesson): 'new' | 'in_progress' | 'academy' | 'done' {
    const p = progress[lesson.id];
    if (!p) return 'new';
    if (p.academyCompleted) return 'done';
    if (p.homeCompleted) return 'academy';
    return 'in_progress';
  }

  const STATUS_CONFIG = {
    new:         { label: 'Yangi',               badge: 'bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]' },
    in_progress: { label: "O'qilmoqda",           badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    academy:     { label: 'Akademiya kutilmoqda', badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
    done:        { label: 'Tugallangan',          badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  };

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">O&apos;quvchi</p>
            <p className="text-white text-xl font-bold">Darslar</p>
          </div>
          {!loading && (
            <div className="bg-[#162032] rounded-[14px] px-3 py-2">
              <p className="text-white text-lg font-black font-mono">{lessons.length}</p>
              <p className="text-[#94a3b8] text-[10px]">Jami</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-6">
        {error && (
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm mb-4">{error}</div>
        )}

        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}>
                <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] px-4 py-3 flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                </div>
              </li>
            ))}
          </ul>
        ) : lessons.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              icon={<BookOpen size={28} />}
              title="Hali darslar qo'shilmagan"
              description="Darslar tez orada qo'shiladi"
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {lessons.map((lesson) => {
              const status = getStatus(lesson);
              const cfg = STATUS_CONFIG[status];
              const p = progress[lesson.id];
              const isDone = status === 'done';
              const isLocked = lesson.orderNumber > 1 && (() => {
                const prev = lessons.find((l) => l.orderNumber === lesson.orderNumber - 1);
                if (!prev) return false;
                return !progress[prev.id]?.academyCompleted;
              })();

              if (isLocked) {
                return (
                  <li key={lesson.id}>
                    <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] px-4 py-3 opacity-50 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#f7f4ef] flex items-center justify-center shrink-0">
                        <Lock size={16} className="text-[#94a3b8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#94a3b8] font-medium">#{lesson.orderNumber}</p>
                        <p className="text-sm text-[#94a3b8] truncate">{lesson.title}</p>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={lesson.id}>
                  <Link
                    href={`/student/lessons/${lesson.id}`}
                    className={`bg-white rounded-[14px] border-[1.5px] px-4 py-3 flex items-center gap-3 transition-colors hover:border-[#0f172a]/30 ${
                      isDone ? 'border-emerald-100' : 'border-[#ede9e1]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-[#0f172a] text-white'
                    }`}>
                      {isDone ? <CheckCircle size={18} /> : <BookMarked size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDone ? 'text-[#94a3b8]' : 'text-[#0f172a]'}`}>
                        #{lesson.orderNumber} — {lesson.title}
                      </p>
                      {p && (
                        <p className="text-xs text-[#94a3b8] mt-0.5">{p.sessionCount} ta sessiya</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
