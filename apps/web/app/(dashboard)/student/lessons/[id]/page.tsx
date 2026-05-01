'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { X, ArrowRight, AlertTriangle } from 'lucide-react';
import { VideoPlayer } from './_components/VideoPlayer';
import { McqTest } from './_components/McqTest';
import { WordOrderTest } from './_components/WordOrderTest';
import { AiTutor } from './_components/AiTutor';
import { FeedbackWidget } from './_components/FeedbackWidget';
import { Hearts } from './_components/Hearts';
import { ProgressBar } from './_components/ProgressBar';
import { LessonIntro } from './_components/LessonIntro';
import { CompletionScreen } from './_components/CompletionScreen';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, Modal, Mascot } from '@/components/ui';

type ComponentFlags = {
  mcq?: boolean;
  word_order?: boolean;
  vocabulary?: boolean;
  ai_tutor?: boolean;
  camera?: boolean;
};

type LessonComponent = {
  id: string;
  type: 'mcq' | 'word_order' | 'vocabulary';
  config: Record<string, unknown>;
};

type McqConfig = {
  question: string;
  options: string[];
  correctIndex: number;
};

type WordOrderConfig = {
  words: string[];
  correct: string;
};

type Lesson = {
  id: string;
  title: string;
  youtubeUrl: string;
  nRepetitions: number;
  hasExam: boolean;
  components: ComponentFlags;
  components_data: LessonComponent[];
  /** Optional metadata used by the intro/completion screens — may not be
   * returned by the lessons API on every tenant. Treated as best-effort. */
  orderNumber?: number;
  description?: string;
  estimatedMinutes?: number;
  xpReward?: number;
};

type ProgressEntry = {
  lessonId: string;
  sessionCount: number;
  homeCompleted: boolean;
  academyCompleted: boolean;
};

type XpData = {
  totalXp: number;
  level: string;
  todayXp?: number;
  dailyGoal?: number;
};

type StreakData = {
  streak: number;
  hasShield: boolean;
};

/** Steps the runner walks through. `intro` is the welcome screen, `done`
 * is the celebration. Everything between is a real exercise. */
type Step = 'intro' | 'video' | 'mcq' | 'word_order' | 'ai_tutor' | 'done';

/** The set of *exercise* steps shown in the progress bar (excludes intro/done). */
const EXERCISE_STEPS: Step[] = ['video', 'mcq', 'word_order', 'ai_tutor'];

const HEARTS_MAX = 3;

function buildSteps(components: ComponentFlags): Step[] {
  const steps: Step[] = ['intro', 'video'];
  if (components.mcq) steps.push('mcq');
  if (components.word_order) steps.push('word_order');
  if (components.ai_tutor) steps.push('ai_tutor');
  steps.push('done');
  return steps;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<ProgressEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('intro');
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);

  // Hearts ("lives") — decremented on wrong answers from any exercise.
  // When this hits 0, we show the "out of hearts" modal which routes the
  // user back to the start of the cycle (same effect as restartCycle).
  const [hearts, setHearts] = useState(HEARTS_MAX);
  const [heartsModalOpen, setHeartsModalOpen] = useState(false);

  // XP / streak / level — captured pre-completion so we can detect a level-up
  // and play levelup.mp3 inside the celebration screen, plus show streak/xp
  // values in the stat tiles. These are best-effort: a fetch failure simply
  // hides the relevant tile rather than blocking the lesson.
  const [xpBefore, setXpBefore] = useState<XpData | null>(null);
  const [xpAfter, setXpAfter] = useState<XpData | null>(null);
  const [streakAfter, setStreakAfter] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [lessonRes, progressRes, xpRes] = await Promise.all([
          apiRequest<Lesson>(`/lessons/${id}`, {}, token),
          apiRequest<ProgressEntry[]>('/progress/my', {}, token),
          apiRequest<XpData>('/gamification/xp', {}, token).catch(() => null),
        ]);
        setLesson(lessonRes.data);
        const myProgress = progressRes.data.find((p) => p.lessonId === id) ?? null;
        setProgress(myProgress);
        if (xpRes) setXpBefore(xpRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dars topilmadi');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  async function completeSession() {
    if (!lesson || completing) return;
    const token = localStorage.getItem('accessToken') ?? '';
    setCompleting(true);
    setSessionError(false);
    try {
      await apiRequest(`/progress/${lesson.id}/complete-session`, { method: 'POST' }, token);
      // Refetch progress + XP + streak in parallel so the celebration screen
      // shows fresh numbers. All three are best-effort — a failure on any one
      // just hides that stat in the completion tiles.
      const [progressRes, xpRes, streakRes] = await Promise.all([
        apiRequest<ProgressEntry[]>('/progress/my', {}, token),
        apiRequest<XpData>('/gamification/xp', {}, token).catch(() => null),
        apiRequest<StreakData>('/gamification/streak', {}, token).catch(() => null),
      ]);
      const updated = progressRes.data.find((p) => p.lessonId === lesson.id);
      if (updated) setProgress(updated);
      if (xpRes) setXpAfter(xpRes.data);
      if (streakRes) setStreakAfter(streakRes.data.streak);
      setStep('done');
    } catch {
      setSessionError(true);
      setStep('done'); // still show the screen, with an error banner + retry
    } finally {
      setCompleting(false);
    }
  }

  function getMcqQuestions() {
    if (!lesson) return [];
    return lesson.components_data
      .filter((c) => c.type === 'mcq')
      .map((c) => {
        const cfg = c.config as McqConfig;
        return { text: cfg?.question ?? '', options: cfg?.options ?? [], correct: cfg?.correctIndex ?? 0 };
      })
      .filter((q) => q.text && q.options.length > 0);
  }

  function getWordOrderSentences() {
    if (!lesson) return [];
    return lesson.components_data
      .filter((c) => c.type === 'word_order')
      .map((c) => {
        const cfg = c.config as WordOrderConfig;
        return { words: cfg?.words ?? [], correct: cfg?.correct ?? '' };
      })
      .filter((s) => s.words.length > 0 && s.correct);
  }

  function goToNextStep() {
    if (!lesson) return;
    const steps = buildSteps(lesson.components);
    const idx = steps.indexOf(step);
    if (idx + 1 < steps.length) {
      const nextStep = steps[idx + 1];
      if (nextStep === 'done') {
        completeSession();
      } else {
        setStep(nextStep);
      }
    }
  }

  function startLesson() {
    // First *real* step after the intro. Buildable from the components flags;
    // video is always present, so we know steps[1] === 'video' here.
    if (!lesson) return;
    const steps = buildSteps(lesson.components);
    const next = steps[1];
    if (next) setStep(next);
  }

  function restartCycle() {
    setStep('video');
    setVideoCompleted(false);
    setHearts(HEARTS_MAX);
    setHeartsModalOpen(false);
  }

  /**
   * Wire an exercise's `onFailed` event into the hearts system.
   *
   * Each call costs the user one heart. If that drains the last heart we
   * surface the "Yuraklar tugadi" modal (which itself offers Restart or
   * Home); otherwise we silently restart the cycle so the user can try
   * again with one fewer heart.
   */
  function handleExerciseFailed() {
    setHearts((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0) {
        // Defer modal so the heart's pop animation renders before the dialog.
        setTimeout(() => setHeartsModalOpen(true), 220);
      } else {
        // Cycle restart with reduced hearts — drop them back to video step.
        setStep('video');
        setVideoCompleted(false);
      }
      return next;
    });
  }

  function handleBackClick() {
    if (step === 'intro' || step === 'done') {
      router.back();
      return;
    }
    setExitModalOpen(true);
  }

  // Total exercises in the lesson (denominator for the progress bar).
  // We count only the exercise steps that are actually enabled.
  const totalExercises = useMemo(() => {
    if (!lesson) return 1;
    return EXERCISE_STEPS.filter((s) => {
      if (s === 'video') return true;
      return Boolean(lesson.components[s as keyof ComponentFlags]);
    }).length;
  }, [lesson]);

  // How many exercises we've already finished (used by the bar's filled width).
  const completedExercises = useMemo(() => {
    if (!lesson) return 0;
    if (step === 'intro') return 0;
    if (step === 'done') return totalExercises;
    const enabled = EXERCISE_STEPS.filter((s) => {
      if (s === 'video') return true;
      return Boolean(lesson.components[s as keyof ComponentFlags]);
    });
    const idx = enabled.indexOf(step as Step);
    return idx === -1 ? 0 : idx;
  }, [lesson, step, totalExercises]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fffaf0]">
        <div className="px-4 pt-5 pb-4 sticky top-0 bg-[#fffaf0] z-30 border-b border-[#f3eedf]">
          <div className="flex items-center gap-3">
            <Skeleton theme="light" className="w-10 h-10 rounded-full shrink-0" />
            <Skeleton theme="light" className="flex-1 h-2 rounded-full" />
            <Skeleton theme="light" className="w-20 h-6 rounded-full shrink-0" />
          </div>
        </div>
        <div className="px-4 pt-6 space-y-4 max-w-md mx-auto">
          <Skeleton theme="light" className="w-full aspect-video rounded-2xl" />
          <Skeleton theme="light" className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border-[1.5px] border-rose-200 p-8 text-center max-w-sm w-full space-y-4">
          <div className="flex justify-center">
            <Mascot expression="sad" size={120} animated />
          </div>
          <p
            className="text-[#3c3c3c] font-extrabold text-lg"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {error || 'Dars topilmadi'}
          </p>
          <Button variant="duo" size="lg" fullWidth onClick={() => router.back()}>
            Orqaga
          </Button>
        </div>
      </div>
    );
  }

  const mcqQuestions = getMcqQuestions();
  const wordOrderSentences = getWordOrderSentences();

  // Compute level-up + accuracy + xp delta for the completion screen.
  const xpEarned =
    xpAfter && xpBefore ? Math.max(0, xpAfter.totalXp - xpBefore.totalXp) : (lesson.xpReward ?? 30);
  const leveledUp = Boolean(
    xpAfter && xpBefore && xpAfter.level !== xpBefore.level,
  );
  const accuracy = Math.round((hearts / HEARTS_MAX) * 100);

  // ─── Intro screen ─────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <LessonIntro
        title={lesson.title}
        orderNumber={lesson.orderNumber}
        subtitle={lesson.description}
        estimatedMinutes={lesson.estimatedMinutes}
        xpReward={lesson.xpReward}
        onStart={startLesson}
        onClose={() => router.push('/student/lessons')}
      />
    );
  }

  // ─── Completion screen ────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <>
        <CompletionScreen
          xpEarned={xpEarned}
          streak={streakAfter ?? undefined}
          accuracy={accuracy}
          leveledUp={leveledUp}
          notice={
            lesson.hasExam
              ? 'Bu darsda imtihon bor. Akademiyaga kelib tester ruxsatini oling.'
              : undefined
          }
          onPrimary={() => router.push('/student/lessons')}
          primaryLabel="Keyingi dars"
          onSecondary={() => router.push('/student')}
          errorBanner={sessionError ? 'Sessiyani saqlashda xato yuz berdi.' : undefined}
          onRetry={sessionError ? completeSession : undefined}
        />
        <FeedbackWidget lessonId={id} />
      </>
    );
  }

  // ─── Running lesson ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      {/* Exit confirmation modal — cream theme to match the page. */}
      <Modal
        open={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        title="Darsdan chiqish"
        size="sm"
        theme="light"
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              className="!text-[#7a5e2c] hover:!bg-[#f3eedf]"
              onClick={() => setExitModalOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button
              variant="duo"
              size="md"
              onClick={() => {
                setExitModalOpen(false);
                router.push('/student/lessons');
              }}
            >
              Chiqish
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <Mascot expression="sad" size={88} animated />
          </div>
          <p
            className="text-sm font-semibold text-[#3c3c3c] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Joriy jarayoningiz saqlanmaydi. Haqiqatan ham chiqmoqchimisiz?
          </p>
        </div>
      </Modal>

      {/* Out-of-hearts modal */}
      <Modal
        open={heartsModalOpen}
        onClose={() => setHeartsModalOpen(false)}
        title="Yuraklar tugadi"
        size="sm"
        theme="light"
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              className="!text-[#7a5e2c] hover:!bg-[#f3eedf]"
              onClick={() => router.push('/student/lessons')}
            >
              Bosh sahifaga
            </Button>
            <Button variant="duo" size="md" onClick={restartCycle}>
              Qaytadan urinish
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <Mascot expression="sad" size={88} animated />
          </div>
          <p
            className="text-sm font-semibold text-[#3c3c3c] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Hechqisi yo&apos;q — yana bir bor urinib ko&apos;ramiz!
          </p>
        </div>
      </Modal>

      {/* Sticky cream header: ✕ + progress bar + hearts */}
      <header className="sticky top-0 z-30 bg-[#fffaf0] border-b border-[#f3eedf]">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackClick}
            aria-label="Yopish"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#777] hover:text-[#3c3c3c] hover:bg-[#f3eedf] transition-colors shrink-0"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
          <ProgressBar
            total={totalExercises}
            completed={completedExercises}
            className="flex-1"
          />
          <Hearts remaining={hearts} max={HEARTS_MAX} />
        </div>
        {progress ? (
          <div className="max-w-md mx-auto px-4 pb-2 flex items-center justify-between">
            <p
              className="text-xs font-extrabold text-[#7a5e2c] uppercase tracking-wider truncate"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {lesson.title}
            </p>
            <span className="text-[10px] font-bold text-[#777] bg-[#f3eedf] border border-[#e8e0d0] px-2 py-0.5 rounded-full shrink-0 ml-2">
              {progress.sessionCount}/{lesson.nRepetitions}
            </span>
          </div>
        ) : null}
      </header>

      {/* Body */}
      <main className="px-4 pt-6 pb-10 space-y-4 max-w-md mx-auto">
        {step === 'video' && (
          <div className="space-y-4">
            <VideoPlayer
              youtubeUrl={lesson.youtubeUrl}
              lessonId={id}
              onCompleted={() => setVideoCompleted(true)}
            />
            {videoCompleted ? (
              <Button
                variant="duo"
                size="lg"
                fullWidth
                iconRight={<ArrowRight size={16} />}
                onClick={goToNextStep}
              >
                Davom etish
              </Button>
            ) : (
              <p className="text-center text-[#777] text-sm font-semibold">
                Davom etish uchun videoni ko&apos;ring
              </p>
            )}
          </div>
        )}

        {step === 'mcq' && mcqQuestions.length > 0 && (
          <McqTest
            questions={mcqQuestions}
            onPassed={goToNextStep}
            onFailed={handleExerciseFailed}
          />
        )}

        {step === 'mcq' && mcqQuestions.length === 0 && (
          <SkipPanel label="MCQ savollar topilmadi" onSkip={goToNextStep} />
        )}

        {step === 'word_order' && wordOrderSentences.length > 0 && (
          <WordOrderTest
            sentences={wordOrderSentences}
            onPassed={goToNextStep}
            onFailed={handleExerciseFailed}
          />
        )}

        {step === 'word_order' && wordOrderSentences.length === 0 && (
          <SkipPanel label="So'z tartibi topshiriqlari topilmadi" onSkip={goToNextStep} />
        )}

        {step === 'ai_tutor' && (
          <AiTutor lessonContext={lesson.title} onCompleted={goToNextStep} />
        )}
      </main>

      {/* Saving overlay — cream surface, Aloqush idle, friendly copy. */}
      {completing && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-40 bg-[#fffaf0]/85 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] shadow-xl px-6 py-6 flex flex-col items-center gap-3 max-w-xs">
            <Mascot expression="idle" size={96} animated />
            <p
              className="text-[#3c3c3c] font-extrabold text-base text-center"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              XP qo&apos;shilmoqda...
            </p>
            <span className="w-5 h-5 border-2 border-[#58cc02]/30 border-t-[#58cc02] rounded-full animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Local helpers ──────────────────────────────────────────────────────────

interface SkipPanelProps {
  label: string;
  onSkip: () => void;
}

/** Tiny inline empty-state for steps whose data wasn't authored yet — gives
 * the user an explicit way to skip ahead instead of getting stuck. */
function SkipPanel({ label, onSkip }: SkipPanelProps) {
  return (
    <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
      <AlertTriangle size={28} className="text-[#fbbf24] mx-auto" />
      <p
        className="text-[#3c3c3c] font-extrabold text-sm"
        style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
      >
        {label}
      </p>
      <Button variant="duo" size="md" onClick={onSkip}>
        Davom etish
      </Button>
    </div>
  );
}
