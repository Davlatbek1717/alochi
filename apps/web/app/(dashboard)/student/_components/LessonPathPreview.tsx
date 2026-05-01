'use client';
import Link from 'next/link';
import { useEffect, useState, type FC, type ReactNode } from 'react';
import { Lock, Check, ArrowRight } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  orderNumber: number;
  isPublished: boolean;
}

interface ProgressRow {
  lessonId: string;
  homeCompleted: boolean;
  academyCompleted: boolean;
  sessionCount: number;
}

type NodeStatus = 'completed' | 'current' | 'locked';

/**
 * LessonPathPreview — horizontal scrollable strip of the student's next
 * 6-7 lessons. Visualises the journey ahead so the student feels pulled
 * forward rather than parked.
 *
 * Status rules (matching /lessons/page.tsx):
 *   - completed  : homeCompleted OR academyCompleted (gold border + check)
 *   - current    : first non-completed published lesson (green pulse ring)
 *   - locked     : everything after the current one (grey)
 *
 * Home completion is the student-driven unlock signal — academyCompleted
 * is mentor-side and must not gate the preview, otherwise the strip parks
 * on the same lesson forever.
 */
export const LessonPathPreview: FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiRequest<Lesson[]>('/lessons', {}, token).catch(() => ({ data: [] as Lesson[] })),
      apiRequest<ProgressRow[]>('/progress/my', {}, token).catch(() => ({ data: [] as ProgressRow[] })),
    ])
      .then(([lessonsRes, progressRes]) => {
        const list = (lessonsRes.data ?? [])
          .filter((l) => l.isPublished)
          .sort((a, b) => a.orderNumber - b.orderNumber);
        const map: Record<string, ProgressRow> = {};
        for (const p of progressRes.data ?? []) map[p.lessonId] = p;
        setLessons(list);
        setProgress(map);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
        <div className="h-4 w-24 bg-[#f3eedf] rounded mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-16 h-16 rounded-full bg-[#f3eedf] animate-pulse shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  if (lessons.length === 0) {
    return null;
  }

  // Find current (first non-completed) lesson index. A lesson counts as
  // completed when home OR academy is done — see component comment above.
  const completedCount = lessons.filter(
    (l) => progress[l.id]?.homeCompleted || progress[l.id]?.academyCompleted,
  ).length;
  const currentIndex = Math.min(completedCount, lessons.length - 1);

  // Show 1 completed lesson before current + current + next 5 = window of 7
  const start = Math.max(0, currentIndex - 1);
  const end = Math.min(lessons.length, start + 7);
  const window = lessons.slice(start, end);

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#777]">
            Sizning yo&apos;lingiz
          </p>
          <p className="text-lg font-extrabold text-[#3c3c3c] leading-tight">
            Keyingi darslar
          </p>
        </div>
        <Link
          href="/student/lessons"
          className="inline-flex items-center gap-1 text-sm font-bold text-[#46a302] hover:text-[#3a8a02] shrink-0"
        >
          Hammasini ko&apos;rish
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="-mx-5 px-5 overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-3 pb-1 min-w-max">
          {window.map((lesson) => {
            const status = pickStatus(lesson, progress, currentIndex, lessons);
            return (
              <PathNode key={lesson.id} lesson={lesson} status={status} />
            );
          })}
        </div>
      </div>
    </div>
  );
};

function pickStatus(
  lesson: Lesson,
  progress: Record<string, ProgressRow>,
  currentIndex: number,
  list: Lesson[],
): NodeStatus {
  const idx = list.findIndex((l) => l.id === lesson.id);
  if (
    progress[lesson.id]?.homeCompleted ||
    progress[lesson.id]?.academyCompleted
  )
    return 'completed';
  if (idx === currentIndex) return 'current';
  return 'locked';
}

const PathNode: FC<{ lesson: Lesson; status: NodeStatus }> = ({
  lesson,
  status,
}) => {
  const isCurrent = status === 'current';
  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';

  const bg = isCompleted
    ? 'bg-amber-50 border-amber-300'
    : isCurrent
      ? 'bg-[#58cc02] border-[#46a302]'
      : 'bg-[#f3eedf] border-[#e8e0d0]';

  const inner: ReactNode = isCompleted ? (
    <Check size={24} className="text-amber-600" strokeWidth={3} />
  ) : isCurrent ? (
    <span className="text-white font-extrabold text-lg">
      {lesson.orderNumber}
    </span>
  ) : (
    <Lock size={20} className="text-[#a89e85]" />
  );

  const wrapperClass = `flex flex-col items-center gap-1.5 shrink-0 w-[72px] ${
    isLocked ? 'opacity-70' : ''
  }`;

  const node = (
    <div className="relative">
      {isCurrent && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full motion-safe:animate-[pulse-ring_1.6s_ease-out_infinite]"
          style={{ boxShadow: '0 0 0 4px rgba(88, 204, 2, 0.35)' }}
        />
      )}
      <div
        className={`relative w-16 h-16 rounded-full border-[3px] flex items-center justify-center shadow-sm ${bg}`}
      >
        {inner}
      </div>
    </div>
  );

  const label = (
    <p className="text-[10px] font-semibold text-[#5b5b5b] text-center line-clamp-2 leading-tight">
      {lesson.title}
    </p>
  );

  if (isLocked) {
    return (
      <div className={wrapperClass} aria-disabled>
        {node}
        {label}
      </div>
    );
  }

  return (
    <Link href={`/student/lessons/${lesson.id}`} className={wrapperClass}>
      {node}
      {label}
    </Link>
  );
};

export default LessonPathPreview;
