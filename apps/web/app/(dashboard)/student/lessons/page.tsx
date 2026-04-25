'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

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
        for (const p of progressRes.data) {
          progressMap[p.lessonId] = p;
        }
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
    new: { label: 'Yangi', color: 'bg-gray-100 text-gray-600' },
    in_progress: { label: "O'qilmoqda", color: 'bg-yellow-100 text-yellow-700' },
    academy: { label: 'Akademiya kutilmoqda', color: 'bg-blue-100 text-blue-700' },
    done: { label: 'Tugallangan', color: 'bg-green-100 text-green-700' },
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 flex justify-center">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Darslar</h1>
        <span className="text-sm text-gray-500">{lessons.length} ta dars</span>
      </div>

      {lessons.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-gray-500">Hali darslar qo&apos;shilmagan</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson) => {
            const status = getStatus(lesson);
            const cfg = STATUS_CONFIG[status];
            const p = progress[lesson.id];
            const isLocked = lesson.orderNumber > 1 && (() => {
              const prev = lessons.find((l) => l.orderNumber === lesson.orderNumber - 1);
              if (!prev) return false;
              const prevProgress = progress[prev.id];
              return !prevProgress?.homeCompleted;
            })();

            return (
              <li key={lesson.id}>
                {isLocked ? (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-60 cursor-not-allowed flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold shrink-0">
                      🔒
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-400">Dars #{lesson.orderNumber}</p>
                      <p className="text-sm text-gray-400 truncate">{lesson.title}</p>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/student/lessons/${lesson.id}`}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                      {lesson.orderNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{lesson.title}</p>
                      {p && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.sessionCount} ta sessiya bajarildi
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
