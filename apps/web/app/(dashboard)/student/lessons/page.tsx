'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Target } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton } from '@/components/ui';
import { StreakFlame } from '../_components/StreakFlame';
import { LessonNode, type NodeState } from './_components/LessonNode';
import { UnitBanner, type UnitTheme } from './_components/UnitBanner';
import { PathSegment } from './_components/PathSegment';
import {
  LessonBottomSheet,
  type SheetLesson,
} from './_components/LessonBottomSheet';

type Lesson = {
  id: string;
  title: string;
  orderNumber: number;
  isPublished: boolean;
  estimatedMinutes?: number;
  xpReward?: number;
  type?: string;
};

type Progress = {
  lessonId: string;
  sessionCount: number;
  homeCompleted: boolean;
  academyCompleted: boolean;
};

type StreakData = { streak: number; hasShield: boolean };
type XpData = { todayXp?: number };

/** Zig-zag column positions (in % of container width) for nodes 1..5 in a unit. */
const ZIGZAG_X: ReadonlyArray<number> = [50, 25, 50, 75, 50];

/** Cycling unit theme palette — repeats after 5. Names lean into A'lochi
 * culture-curriculum themes (greetings → numbers → food → family → travel) so
 * the order maps reasonably to lesson content. */
const UNIT_THEMES: ReadonlyArray<UnitTheme> = [
  { bg: '#58cc02', shadow: '#46a302', title: "Salomlashish" },
  { bg: '#1cb0f6', shadow: '#0e8bc7', title: "Asosiy so'zlar" },
  { bg: '#ce82ff', shadow: '#9b4fd1', title: "Sonlar" },
  { bg: '#ff4b4b', shadow: '#b91c1c', title: "Ovqatlanish" },
  { bg: '#ff9600', shadow: '#c2410c', title: "Oila" },
];

const UNIT_SIZE = 5;

export default function LessonsPathPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [todayXp, setTodayXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bottom-sheet state.
  const [sheetLesson, setSheetLesson] = useState<SheetLesson | null>(null);
  const [sheetState, setSheetState] = useState<'current' | 'completed'>('current');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Auto-scroll-into-view target for the current node.
  const currentNodeRef = useRef<HTMLButtonElement | null>(null);

  // FAB visibility — show "scroll to current" when the current node has
  // scrolled out of view (e.g. user scrolled forward to peek at later
  // units). The FAB hides itself the moment the node is back in the
  // viewport so it doesn't obstruct the path.
  const [fabVisible, setFabVisible] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let cancelled = false;
    async function load() {
      setError('');
      try {
        // Lessons is the only blocking call — progress / streak / xp are
        // best-effort so a transient gamification failure doesn't blank the
        // path. Previously a 5xx on any of those four would surface as
        // "Xato yuz berdi" even though lessons themselves loaded fine.
        const lessonsRes = await apiRequest<Lesson[]>('/lessons', {}, token);
        const [progressRes, streakRes, xpRes] = await Promise.all([
          apiRequest<Progress[]>('/progress/my', {}, token).catch(
            () => ({ data: [] as Progress[] }),
          ),
          apiRequest<StreakData>('/gamification/streak', {}, token).catch(
            () => ({ data: { streak: 0, hasShield: false } as StreakData }),
          ),
          apiRequest<XpData>('/gamification/xp', {}, token).catch(
            () => ({ data: { todayXp: 0 } as XpData }),
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
        setHasShield(streakRes.data?.hasShield ?? false);
        setTodayXp(xpRes.data?.todayXp ?? 0);
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
  }, []);

  // Compute per-lesson state + the index of the "current" lesson.
  //
  // A lesson is "completed" — and therefore unlocks the next node — when
  // EITHER the student finished the home portion (sessionCount >=
  // nRepetitions, set by ProgressService.completeSession) OR the mentor has
  // marked the academy portion complete. Previously we only respected
  // `academyCompleted`, which is a mentor-side flag — meaning the student
  // could never advance their own path even after grinding all sessions.
  // Home completion is the student-driven unlock signal.
  const { lessonStates, currentIndex } = useMemo(() => {
    const states: NodeState[] = [];
    let current = -1;
    for (let i = 0; i < lessons.length; i++) {
      const l = lessons[i];
      const p = progress[l.id];
      if (p?.homeCompleted || p?.academyCompleted) {
        states.push('completed');
      } else if (current === -1) {
        states.push('current');
        current = i;
      } else {
        states.push('locked');
      }
    }
    // If everything is completed, surface the last completed as the visual current
    // for scroll-into-view purposes (without changing its node state).
    if (current === -1 && lessons.length > 0) {
      current = lessons.length - 1;
    }
    return { lessonStates: states, currentIndex: current };
  }, [lessons, progress]);

  // Auto-scroll current node into view on first paint after data loads.
  useEffect(() => {
    if (loading) return;
    const el = currentNodeRef.current;
    if (!el) return;
    // Defer one frame so the layout settles before scrolling.
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [loading, currentIndex]);

  // Track whether the current-node button is in the viewport. When it
  // leaves we show a floating "back to current" FAB. IntersectionObserver
  // is cheap and fires only on threshold crossings, so this won't burn
  // frames on long paths.
  useEffect(() => {
    if (loading) return;
    const el = currentNodeRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Hide the FAB while the node is on screen (any portion).
        // Show it when the node is fully out — the user has scrolled
        // away to peek at locked nodes or earlier units.
        setFabVisible(!entry.isIntersecting);
      },
      // Trigger slightly before the node leaves so the FAB doesn't snap
      // in at the very edge.
      { threshold: 0, rootMargin: '-80px 0px -80px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, currentIndex]);

  const scrollToCurrent = useCallback(() => {
    const el = currentNodeRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Group lessons into units of 5.
  const units = useMemo(() => {
    const groups: { lessons: Lesson[]; states: NodeState[]; theme: UnitTheme }[] = [];
    for (let i = 0; i < lessons.length; i += UNIT_SIZE) {
      const slice = lessons.slice(i, i + UNIT_SIZE);
      const stateSlice = lessonStates.slice(i, i + UNIT_SIZE);
      const themeIdx = Math.floor(i / UNIT_SIZE) % UNIT_THEMES.length;
      groups.push({
        lessons: slice,
        states: stateSlice,
        theme: UNIT_THEMES[themeIdx],
      });
    }
    return groups;
  }, [lessons, lessonStates]);

  function openSheetForLesson(idx: number) {
    const lesson = lessons[idx];
    if (!lesson) return;
    const state = lessonStates[idx];
    if (state === 'locked') return;
    const unitIdx = Math.floor(idx / UNIT_SIZE);
    const theme = UNIT_THEMES[unitIdx % UNIT_THEMES.length];
    setSheetLesson({
      id: lesson.id,
      title: lesson.title,
      orderNumber: lesson.orderNumber,
      unitName: `${unitIdx + 1}-bo'lim · ${theme.title}`,
      estimatedMinutes: lesson.estimatedMinutes,
      xpReward: lesson.xpReward,
      type: lesson.type,
    });
    setSheetState(state === 'completed' ? 'completed' : 'current');
    setSheetOpen(true);
  }

  function startLesson(lessonId: string) {
    setSheetOpen(false);
    router.push(`/student/lessons/${lessonId}`);
  }

  // Overall progress numbers for the header ribbon.
  const completedCount = useMemo(
    () => lessonStates.filter((s) => s === 'completed').length,
    [lessonStates],
  );
  const totalCount = lessons.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      {/* Sticky top bar with overall progress ribbon */}
      <header className="sticky top-0 z-30 bg-[#fffaf0]/95 backdrop-blur border-b border-[#ede9e1]">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-3">
            <Link
              href="/student"
              aria-label="Ortga"
              className="w-9 h-9 rounded-full bg-white border border-[#ede9e1] flex items-center justify-center text-[#3c3c3c] hover:bg-[#f3eedf] transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0 text-center">
              <h1 className="text-base font-extrabold text-[#3c3c3c] leading-tight">
                Sayohat xaritasi
              </h1>
              {totalCount > 0 && (
                <p className="text-[11px] font-bold text-[#777] leading-snug">
                  {completedCount} / {totalCount} dars · {progressPct}%
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StreakFlame streak={streak} hasShield={hasShield} size={24} showLabel={false} />
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#46a302]">
                <Sparkles size={14} className="text-[#fbbf24]" /> {todayXp}
              </span>
            </div>
          </div>
          {/* Progress ribbon — slim duo-green track that fills as the
              student completes lessons. Only rendered once we have data so
              it doesn't flash empty during load. */}
          {totalCount > 0 && (
            <div className="mt-2 h-1.5 bg-[#e8e0d0] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#58cc02] to-[#46a302] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {error && (
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-2xl text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <PathSkeleton />
        ) : lessons.length === 0 ? (
          <EmptyPath />
        ) : (
          <div className="space-y-8">
            {units.map((unit, unitIdx) => (
              <UnitBlock
                key={unitIdx}
                unitIdx={unitIdx}
                unit={unit}
                onNodeClick={(localIdx) =>
                  openSheetForLesson(unitIdx * UNIT_SIZE + localIdx)
                }
                isCurrentNode={(localIdx) =>
                  unitIdx * UNIT_SIZE + localIdx === currentIndex
                }
                currentNodeRef={currentNodeRef}
              />
            ))}

            <EndOfPathTile completedAll={currentIndex >= lessons.length - 1 && lessonStates[lessonStates.length - 1] === 'completed'} />
          </div>
        )}
      </main>

      {/* Floating "back to current" button — appears only when the
          current node is off-screen so it never overlaps the path while
          the student is naturally working through it. Lives above the
          bottom-nav safe area. */}
      {fabVisible && !loading && lessons.length > 0 && (
        <button
          type="button"
          onClick={scrollToCurrent}
          aria-label="Joriy darsga qaytish"
          className="fixed left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 bg-[#58cc02] text-white border-b-[4px] border-[#46a302] px-4 py-2.5 rounded-full font-extrabold text-sm uppercase tracking-wide active:translate-y-[2px] active:border-b-[2px] transition-all shadow-lg motion-safe:animate-[bounce-in_300ms_ease-out]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
        >
          <Target size={16} />
          Joriy dars
        </button>
      )}

      <LessonBottomSheet
        open={sheetOpen}
        lesson={sheetLesson}
        state={sheetState}
        onClose={() => setSheetOpen(false)}
        onStart={startLesson}
      />
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

interface UnitBlockProps {
  unitIdx: number;
  unit: { lessons: Lesson[]; states: NodeState[]; theme: UnitTheme };
  onNodeClick: (localIdx: number) => void;
  isCurrentNode: (localIdx: number) => boolean;
  currentNodeRef: React.MutableRefObject<HTMLButtonElement | null>;
}

function UnitBlock({
  unitIdx,
  unit,
  onNodeClick,
  isCurrentNode,
  currentNodeRef,
}: UnitBlockProps) {
  const allCompleted = unit.states.length === UNIT_SIZE && unit.states.every((s) => s === 'completed');

  return (
    <section aria-label={`${unitIdx + 1}-bo'lim`}>
      <UnitBanner
        unitNumber={unitIdx + 1}
        theme={unit.theme}
        completed={allCompleted}
      />

      {/* Path body — relative container so we can absolutely-position the
          curving SVG segments between the flow-laid-out nodes. */}
      <div className="relative pt-6">
        {unit.lessons.map((lesson, localIdx) => {
          const state = unit.states[localIdx];
          const x = ZIGZAG_X[localIdx] ?? 50;
          const isFirst = localIdx === 0;
          const prevX = isFirst ? null : (ZIGZAG_X[localIdx - 1] ?? 50);
          const prevState = isFirst ? null : unit.states[localIdx - 1];
          const segmentCompleted =
            !!prevState &&
            (prevState === 'completed') &&
            (state === 'completed' || state === 'current');

          return (
            <div
              key={lesson.id}
              className="relative"
              style={{ height: '128px' }}
            >
              {/* Connector segment from previous node into this one. */}
              {prevX !== null && (
                <PathSegment
                  fromX={prevX}
                  toX={x}
                  completed={segmentCompleted}
                  height={48}
                />
              )}

              {/* Node — absolute-positioned by its x-percentage. */}
              <div
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <LessonNode
                  ref={isCurrentNode(localIdx) ? currentNodeRef : undefined}
                  state={state}
                  positionLabel={localIdx + 1}
                  accentColor={unit.theme.bg}
                  accentShadow={unit.theme.shadow}
                  ariaLabel={`Dars ${lesson.orderNumber}: ${lesson.title}`}
                  onClick={() => onNodeClick(localIdx)}
                />
              </div>
            </div>
          );
        })}

        {/* Treasure-chest reward when all 5 lessons completed. */}
        {allCompleted && <TreasureChestNode />}
      </div>
    </section>
  );
}

function TreasureChestNode() {
  return (
    <div className="mt-4 flex flex-col items-center gap-1.5">
      <div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-b from-[#fbbf24] to-[#d97706] border-b-[4px] border-[#92400e] shadow-[0_4px_0_rgba(0,0,0,0.08)] motion-safe:animate-[bounce-in_500ms_ease-out]"
        aria-label="Bo'lim mukofoti"
        role="img"
      >
        {/* Soft amber halo so the chest reads as "claimed reward" not
            just another node. Hidden under reduced-motion via the
            global motion-safe override in globals.css. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-[#fbbf24]/40 blur-md motion-safe:animate-pulse pointer-events-none"
        />
        <span className="relative" aria-hidden>🎁</span>
      </div>
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#d97706]">
        Bo&apos;lim tugadi · +50 XP
      </p>
    </div>
  );
}

function EndOfPathTile({ completedAll }: { completedAll: boolean }) {
  // Two distinct states deserve two distinct cards:
  //   - completedAll: the student has cleared every published lesson.
  //     Celebrate them and explain why there's nothing past this point.
  //   - !completedAll: they've reached the end of the rendered path
  //     before completing it (fast scroller). Encourage them back.
  if (completedAll) {
    return (
      <div className="relative overflow-hidden rounded-3xl border-[1.5px] border-[#fbbf24]/40 p-5 bg-gradient-to-br from-[#fffbeb] via-[#fef3c7] to-[#fde68a] motion-safe:animate-[bounce-in_500ms_ease-out]">
        <div
          aria-hidden
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#fbbf24]/25"
        />
        <div className="relative flex items-center gap-4">
          <div className="shrink-0">
            <Mascot expression="happy" size={80} animated />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#92400e]">
              Barcha darslar bajarildi
            </p>
            <p className="text-base font-extrabold text-[#7c2d12] leading-tight mt-1">
              Sayohat oxiriga yetdingiz! 🎉
            </p>
            <p className="text-xs font-bold text-[#92400e]/80 leading-snug mt-1">
              Yangi darslar tez orada qo&apos;shiladi. Ungacha takrorlang yoki do&apos;stlar bilan duel qiling.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-3xl border-[1.5px] border-dashed border-[#ede9e1] p-5 flex items-center gap-4">
      <div className="shrink-0">
        <Mascot expression="sleeping" size={72} animated />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#777]">
          Yo&apos;l davom etadi
        </p>
        <p className="text-sm font-bold text-[#3c3c3c] leading-snug mt-0.5">
          Keyingi darslar qulflangan — joriy darsdan boshlashda davom eting
        </p>
      </div>
    </div>
  );
}

function PathSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton theme="light" className="h-24 w-full rounded-2xl" />
      <div className="flex flex-col items-center gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            theme="light"
            className="w-20 h-20 rounded-full"
          />
        ))}
      </div>
    </div>
  );
}

function EmptyPath() {
  return (
    <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-8 flex flex-col items-center text-center">
      <Mascot expression="sleeping" size={120} animated />
      <h2 className="text-lg font-extrabold text-[#3c3c3c] mt-4">
        Hali darslar qo&apos;shilmagan
      </h2>
      <p className="text-sm text-[#777] font-semibold mt-1">
        Darslar tez orada qo&apos;shiladi
      </p>
    </div>
  );
}
