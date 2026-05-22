'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Ustoz } from '@/components/Ustoz';

type Lesson = {
  id: string;
  title: string;
  orderNumber: number;
  isPublished: boolean;
  estimatedMinutes?: number;
  type?: string;
};

type Progress = {
  lessonId: string;
  sessionCount: number;
  homeCompleted: boolean;
  academyCompleted: boolean;
};

type StreakData = { streak: number; hasShield: boolean };
type NodeState = 'completed' | 'current' | 'locked';

/** Unit titles — lean into the culture-curriculum themes. Cycles after 5. */
const UNIT_TITLES: ReadonlyArray<string> = [
  'Salomlashish',
  "Asosiy so'zlar",
  'Sonlar',
  'Ovqatlanish',
  'Oila',
];
const UNIT_SIZE = 5;

export default function LessonsPathPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Bumping reloadKey re-runs the load effect — used by the retry button.
  const [reloadKey, setReloadKey] = useState(0);
  const retryLoad = () => {
    setError('');
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let cancelled = false;
    async function load() {
      setError('');
      try {
        // Lessons is the only blocking call — progress / streak are
        // best-effort so a transient gamification failure doesn't blank the
        // path.
        const lessonsRes = await apiRequest<Lesson[]>('/lessons', {}, token);
        const [progressRes, streakRes] = await Promise.all([
          apiRequest<Progress[]>('/progress/my', {}, token).catch(
            () => ({ data: [] as Progress[] }),
          ),
          apiRequest<StreakData>('/gamification/streak', {}, token).catch(
            () => ({ data: { streak: 0, hasShield: false } as StreakData }),
          ),
        ]);
        if (cancelled) return;
        const sorted = (lessonsRes.data ?? [])
          .filter((l) => l.isPublished)
          .sort((a, b) => a.orderNumber - b.orderNumber);
        const map: Record<string, Progress> = {};
        for (const p of progressRes.data ?? []) map[p.lessonId] = p;
        setLessons(sorted);
        setProgress(map);
        setStreak(streakRes.data?.streak ?? 0);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Xato yuz berdi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Per-lesson state. A lesson unlocks the next when EITHER the student
  // finished the home portion OR the mentor marked academy complete.
  const lessonStates = useMemo(() => {
    const states: NodeState[] = [];
    let foundCurrent = false;
    for (const l of lessons) {
      const p = progress[l.id];
      if (p?.homeCompleted || p?.academyCompleted) {
        states.push('completed');
      } else if (!foundCurrent) {
        states.push('current');
        foundCurrent = true;
      } else {
        states.push('locked');
      }
    }
    return states;
  }, [lessons, progress]);

  // Group lessons into units of 5.
  const units = useMemo(() => {
    const groups: { lessons: Lesson[]; states: NodeState[]; title: string }[] = [];
    for (let i = 0; i < lessons.length; i += UNIT_SIZE) {
      groups.push({
        lessons: lessons.slice(i, i + UNIT_SIZE),
        states: lessonStates.slice(i, i + UNIT_SIZE),
        title: UNIT_TITLES[Math.floor(i / UNIT_SIZE) % UNIT_TITLES.length],
      });
    }
    return groups;
  }, [lessons, lessonStates]);

  const completedCount = useMemo(
    () => lessonStates.filter((s) => s === 'completed').length,
    [lessonStates],
  );
  const totalCount = lessons.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function openLesson(lessonId: string, state: NodeState) {
    if (state === 'locked') return;
    router.push(`/student/lessons/${lessonId}`);
  }

  return (
    <div className="sp-theme min-h-full pb-24">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
          borderBottom: '1.5px solid var(--line)',
        }}
      >
        <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-3">
            <Link
              href="/student"
              aria-label="Ortga"
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'var(--bone-2)',
                border: '1.5px solid var(--line)',
                color: 'var(--ink)',
              }}
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="sp-eyebrow">Dars yo‘l xaritasi</div>
              <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
                Darslar
              </h1>
            </div>
            {totalCount > 0 && (
              <span
                className="sp-mono inline-flex items-center gap-1 px-2.5 py-1 shrink-0"
                style={{
                  background: 'var(--leaf-tint)',
                  color: 'var(--leaf-deep)',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ◉ {completedCount} / {totalCount}
              </span>
            )}
            <span
              className="sp-mono inline-flex items-center gap-1 px-2 py-1 shrink-0"
              style={{
                background: 'var(--ember-tint)',
                color: 'var(--ember-deep)',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              🔥 {streak}
            </span>
          </div>
          {totalCount > 0 && (
            <div
              className="mt-2 h-2 overflow-hidden"
              style={{ background: 'var(--paper-3)', borderRadius: 999 }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: 'var(--leaf)',
                  borderRadius: 999,
                }}
              />
            </div>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-4">
        {error && (
          <div
            className="px-4 py-3 mb-4 text-sm flex items-center justify-between gap-3 flex-wrap"
            style={{
              background: 'var(--ember-tint)',
              border: '1.5px solid var(--ember-soft)',
              color: 'var(--ember-deep)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={retryLoad}
              className="sp-display inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs"
              style={{
                background: 'var(--bone)',
                color: 'var(--ember-deep)',
                border: '1px solid var(--ember-soft)',
                borderRadius: 'var(--r-2)',
                fontWeight: 700,
              }}
            >
              Qayta urinish
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="sp-skeleton h-5 w-40" />
            <div className="sp-skeleton h-40 w-full" style={{ borderRadius: 'var(--r-3)' }} />
            <div className="sp-skeleton h-5 w-40" />
            <div className="sp-skeleton h-40 w-full" style={{ borderRadius: 'var(--r-3)' }} />
          </div>
        ) : lessons.length === 0 ? (
          <div
            className="p-8 flex flex-col items-center text-center"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-4)',
            }}
          >
            <Ustoz size={120} mood="calm" />
            <h2 className="sp-display text-lg mt-4" style={{ color: 'var(--ink)' }}>
              Darslar topilmadi
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
              Tez orada qo‘shiladi
            </p>
            <Link
              href="/student"
              className="sp-display mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
              style={{
                background: 'var(--leaf)',
                color: 'var(--bone)',
                border: '2px solid var(--leaf-deep)',
                borderRadius: 'var(--r-3)',
                boxShadow: '0 4px 0 var(--leaf-deep)',
                fontWeight: 700,
              }}
            >
              Bosh sahifaga qaytish
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {units.map((unit, unitIdx) => {
              const doneInUnit = unit.states.filter((s) => s === 'completed').length;
              const isLocked = unit.states.every((s) => s === 'locked');
              const isCurrent = unit.states.some((s) => s === 'current');
              const allDone = doneInUnit === unit.lessons.length;
              return (
                <section key={unitIdx} style={{ opacity: isLocked ? 0.55 : 1 }}>
                  <div className="flex items-baseline gap-2 mb-2 px-1">
                    <span className="sp-mono text-xs" style={{ color: 'var(--ink-3)' }}>
                      Bo‘lim {unitIdx + 1}
                    </span>
                    <span className="sp-display text-base" style={{ color: 'var(--ink)' }}>
                      {unit.title}
                    </span>
                  </div>
                  <div
                    className="p-4"
                    style={{
                      background: isCurrent ? 'var(--bone-2)' : 'var(--bone)',
                      border: '1.5px solid var(--line)',
                      borderRadius: 'var(--r-3)',
                      boxShadow: 'var(--shadow-1)',
                    }}
                  >
                    <div className="grid grid-cols-4 gap-2.5">
                      {unit.lessons.map((lesson, i) => {
                        const st = unit.states[i];
                        const bg =
                          st === 'completed'
                            ? 'var(--leaf)'
                            : st === 'current'
                              ? 'var(--ember)'
                              : 'var(--paper-2)';
                        const deep =
                          st === 'completed'
                            ? 'var(--leaf-deep)'
                            : st === 'current'
                              ? 'var(--ember-deep)'
                              : null;
                        const fg =
                          st === 'locked' ? 'var(--ink-4)' : 'var(--bone)';
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            disabled={st === 'locked'}
                            onClick={() => openLesson(lesson.id, st)}
                            aria-label={`Dars ${lesson.orderNumber}: ${lesson.title}`}
                            className="relative aspect-square rounded-full flex items-center justify-center sp-display active:translate-y-[2px] transition-transform"
                            style={{
                              background: bg,
                              border: `2px solid ${st === 'locked' ? 'var(--line-2)' : 'var(--ink)'}`,
                              boxShadow: deep ? `0 3px 0 ${deep}` : 'none',
                              color: fg,
                              fontSize: 17,
                              fontWeight: 700,
                              cursor: st === 'locked' ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {st === 'locked'
                              ? '🔒'
                              : st === 'completed'
                                ? '✓'
                                : i + 1}
                            {st === 'current' && (
                              <span
                                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full"
                                style={{
                                  background: 'var(--gold)',
                                  border: '2px solid var(--ink)',
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="flex justify-between items-center mt-3 sp-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <span>
                        {doneInUnit} / {unit.lessons.length} tugatildi
                      </span>
                      {isLocked ? (
                        <span style={{ color: 'var(--ember-deep)' }}>
                          🔒 oldingi bo‘limni tugating
                        </span>
                      ) : allDone ? (
                        <span style={{ color: 'var(--leaf)' }}>✓ tugatildi</span>
                      ) : isCurrent ? (
                        <span style={{ color: 'var(--leaf)' }}>davom etilmoqda</span>
                      ) : null}
                    </div>
                  </div>
                </section>
              );
            })}

            {completedCount === totalCount && totalCount > 0 && (
              <div
                className="relative overflow-hidden p-5 flex items-center gap-4"
                style={{
                  background: 'var(--gold-tint)',
                  border: '1.5px solid var(--gold-soft)',
                  borderRadius: 'var(--r-4)',
                }}
              >
                <Ustoz size={80} mood="cheer" className="shrink-0" />
                <div className="min-w-0">
                  <p className="sp-eyebrow" style={{ color: 'var(--gold-deep)' }}>
                    Barcha darslar bajarildi
                  </p>
                  <p className="sp-display text-base leading-tight mt-1" style={{ color: 'var(--ink)' }}>
                    Sayohat oxiriga yetdingiz! 🎉
                  </p>
                  <p className="text-xs leading-snug mt-1" style={{ color: 'var(--ink-2)' }}>
                    Yangi darslar tez orada qo‘shiladi. Ungacha takrorlang yoki
                    do‘stlar bilan duel qiling.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
