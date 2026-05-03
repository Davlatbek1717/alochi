'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Camera, CheckCircle2, XCircle, AlertTriangle, BookOpen } from 'lucide-react';

// Exercise components — reused directly from the lesson runner
import { McqTest } from '../lessons/[id]/_components/McqTest';
import { WordOrderTest } from '../lessons/[id]/_components/WordOrderTest';
import { TranslateInput } from '../lessons/[id]/_components/TranslateInput';
import { FillBlank } from '../lessons/[id]/_components/FillBlank';
import { OrderSentences } from '../lessons/[id]/_components/OrderSentences';
import { ListenPick } from '../lessons/[id]/_components/ListenPick';
import { ListenType } from '../lessons/[id]/_components/ListenType';
import { SpellingDrill } from '../lessons/[id]/_components/SpellingDrill';
import { MatchPairs } from '../lessons/[id]/_components/MatchPairs';
import { PickPicture } from '../lessons/[id]/_components/PickPicture';
import { SpeakSentence } from '../lessons/[id]/_components/SpeakSentence';
import { SpeakWords } from '../lessons/[id]/_components/SpeakWords';
import type {
  TranslateConfig,
  FillBlankConfig,
  OrderSentencesConfig,
  ListenPickConfig,
  ListenTypeConfig,
  SpellingConfig,
  MatchPairsConfig,
  PickPictureConfig,
  SpeakSentenceConfig,
  SpeakWordsConfig,
} from '../lessons/[id]/_components/exercise-types';
import { ProgressBar } from '../lessons/[id]/_components/ProgressBar';
import { CameraMonitor } from '../lessons/[id]/_components/CameraMonitor';
import { OralExamRunner } from './_components/OralExamRunner';

import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState } from '@/components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type McqQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

type ExamQuestion = {
  id: string;
  type: string;
  config: Record<string, unknown>;
  orderIndex: number;
};

/**
 * `lesson` is set for legacy lesson-anchored exams (Lesson.hasExam + MCQ
 * components); `exam` is set for standalone catalogue exams with polymorphic
 * questions. The service guarantees exactly one is present.
 */
type ActiveExam = {
  id: string;
  lessonId: string | null;
  examId: string | null;
  status: 'active' | 'done' | 'failed';
  score: number | null;
  passed: boolean | null;
  completedAt: string | null;
  lesson: {
    id: string;
    title: string;
    components_data: { id: string; type: string; config: Record<string, unknown> }[];
  } | null;
  exam: {
    id: string;
    title: string;
    description: string | null;
    kind: 'test' | 'ai_oral';
    language: 'uz' | 'en' | null;
    aiPrompt: string | null;
    maxMinutes: number | null;
    passThreshold: number;
    timeLimitMinutes: number | null;
    questions: ExamQuestion[];
  } | null;
  // Saved oral-exam state. Present (via getMyActive include) for any
  // catalogue exam of kind=ai_oral the student has started; null for
  // legacy/test exams.
  oralSession: {
    id: string;
    status: 'active' | 'completed' | 'expired';
    score: number | null;
    passed: boolean | null;
    aiAnalysis: {
      strengths?: string[];
      weaknesses?: string[];
      recommendations?: string[];
    } | null;
    completedAt: string | null;
  } | null;
};

type ExamResult = {
  passed: boolean;
  score: number;
  correct: number;
  total: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function StudentExamsPage() {
  const router = useRouter();
  const [permission, setPermission] = useState<ActiveExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraWarnings, setCameraWarnings] = useState(0);
  const [examAborted, setExamAborted] = useState(false);
  const warningRef = useRef(0);

  // ── Catalogue exam runner state ──────────────────────────────────────────
  /** Index of the currently displayed question (catalogue mode). */
  const [currentIdx, setCurrentIdx] = useState(0);
  /** Accumulated correctness per question — stored in a ref to avoid stale
   *  closure issues and because it doesn't need to drive re-renders. */
  const resultsRef = useRef<boolean[]>([]);
  /** Final result after POST /submit. */
  const [result, setResult] = useState<ExamResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Legacy MCQ state (lesson-anchored exams) ─────────────────────────────
  const [legacyQuestions, setLegacyQuestions] = useState<McqQuestion[]>([]);
  const [legacyAnswers, setLegacyAnswers] = useState<(number | null)[]>([]);
  const [legacySubmitting, setLegacySubmitting] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ActiveExam | null>('/exams/my-active', {}, token)
      .then((res) => {
        setPermission(res.data);
        if (res.data?.lesson) {
          // Legacy: extract MCQ questions from lesson components_data.
          // Lesson MCQ stores questions in two shapes — aggregate
          // { questions: [{ text, options, correct }, ...] } or flat
          // { question, options, correctIndex } — depending on which
          // seed/UI authored it. Mirror the lesson runner's extractor
          // so both shapes flow through to the legacy renderer.
          const qs: McqQuestion[] = [];
          for (const c of res.data.lesson.components_data ?? []) {
            if (c.type !== 'mcq') continue;
            const cfg = c.config as {
              questions?: Array<{ text?: string; options?: string[]; correct?: number }>;
              question?: string;
              options?: string[];
              correctIndex?: number;
            };
            if (Array.isArray(cfg?.questions) && cfg.questions.length > 0) {
              for (const q of cfg.questions) {
                if (q?.text && Array.isArray(q.options) && q.options.length > 0) {
                  qs.push({
                    question: q.text,
                    options: q.options,
                    correctIndex: typeof q.correct === 'number' ? q.correct : 0,
                  });
                }
              }
            } else if (cfg?.question && Array.isArray(cfg.options) && cfg.options.length > 0) {
              qs.push({
                question: cfg.question,
                options: cfg.options,
                correctIndex: typeof cfg.correctIndex === 'number' ? cfg.correctIndex : 0,
              });
            }
          }
          setLegacyQuestions(qs);
          setLegacyAnswers(Array(qs.length).fill(null));
        }
        if (res.data?.exam) {
          // Catalogue: pre-fill results ref with false for every question
          const sorted = (res.data.exam.questions ?? [])
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex);
          resultsRef.current = Array(sorted.length).fill(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Camera monitor ───────────────────────────────────────────────────────
  const handleLookAway = useCallback(() => {
    warningRef.current += 1;
    setCameraWarnings(warningRef.current);
    if (warningRef.current >= 3) setExamAborted(true);
  }, []);

  // ── Catalogue exam: advance after each question ──────────────────────────
  function recordAndAdvance(correct: boolean) {
    if (!permission?.exam) return;
    const total = permission.exam.questions.length;

    // Mutate ref in-place — no re-render needed just to track correctness.
    resultsRef.current[currentIdx] = correct;

    if (currentIdx + 1 < total) {
      setCurrentIdx((i) => i + 1);
    } else {
      // Last question answered — submit the full results array.
      submitCatalogue([...resultsRef.current]);
    }
  }

  async function submitCatalogue(finalResults: boolean[]) {
    if (!permission) return;
    setSubmitting(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<ExamResult>(
        `/exams/${permission.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ results: finalResults }),
        },
        token,
      );
      setResult(res.data);
    } catch {
      // Show a minimal result screen so the student isn't stuck
      const correct = finalResults.filter(Boolean).length;
      const total = finalResults.length;
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      const threshold = permission.exam?.passThreshold ?? 70;
      setResult({ passed: score >= threshold, score, correct, total });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Legacy submit ────────────────────────────────────────────────────────
  async function handleLegacySubmit() {
    if (!permission) return;
    const allAnswered = legacyAnswers.every((a) => a !== null);
    if (!allAnswered) return;

    setLegacySubmitting(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<ExamResult>(
        `/exams/${permission.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers: legacyAnswers }),
        },
        token,
      );
      setResult(res.data);
    } catch {
      // keep result null — error banner not shown to avoid blocking flow
    } finally {
      setLegacySubmitting(false);
    }
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <Skeleton className="h-3 w-20 mb-2 rounded" />
          <Skeleton className="h-6 w-32 rounded" />
        </div>
        <div className="px-4 pt-5 space-y-4">
          <Skeleton theme="light" className="h-32 w-full rounded-[18px]" />
          <Skeleton theme="light" className="h-40 w-full rounded-[18px]" />
        </div>
      </div>
    );
  }

  // ─── Result screen ────────────────────────────────────────────────────────
  if (result) {
    const passed = result.passed;
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] p-8 text-center max-w-sm w-full space-y-5">
          <div
            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto ${
              passed
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-rose-200 bg-rose-50'
            }`}
          >
            {passed ? (
              <CheckCircle2 size={40} className="text-emerald-500" />
            ) : (
              <XCircle size={40} className="text-rose-500" />
            )}
          </div>
          <div>
            <p className="text-2xl font-black text-[#0f172a]">
              {passed ? "O'tdi!" : "O'tmadi"}
            </p>
            <p className="text-[#64748b] text-sm mt-1">
              {result.total > 0
                ? `${result.correct}/${result.total} to'g'ri — ${result.score}%`
                : 'Imtihon yakunlandi'}
            </p>
          </div>
          {passed ? (
            <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Tabriklaymiz! Dars to&apos;liq yakunlandi.
            </p>
          ) : (
            <p className="text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              Imtihondan o&apos;tish uchun{' '}
              {permission?.exam?.passThreshold ?? 70}% kerak. Qayta urinish
              uchun testerga murojaat qiling.
            </p>
          )}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl"
            onClick={() => router.push('/student')}
          >
            Bosh sahifaga
          </Button>
        </div>
      </div>
    );
  }

  // ─── Aborted (camera) ─────────────────────────────────────────────────────
  if (examAborted) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-rose-200 p-8 text-center max-w-sm w-full space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center mx-auto">
            <AlertTriangle size={32} className="text-rose-500" />
          </div>
          <p className="text-xl font-bold text-[#0f172a]">Imtihon bekor qilindi</p>
          <p className="text-[#64748b] text-sm">
            3 marta kameradan uzoqlashganligi sababli imtihon to&apos;xtatildi.
            Qayta urinish uchun testerga murojaat qiling.
          </p>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl"
            onClick={() => router.push('/student')}
          >
            Bosh sahifaga
          </Button>
        </div>
      </div>
    );
  }

  // ─── No active exam ───────────────────────────────────────────────────────
  if (!permission) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-8 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-48 h-48 md:w-72 md:h-72 rounded-full opacity-10"
            style={{
              background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
              transform: 'translate(30%, -30%)',
            }}
          />
          <div className="relative z-10">
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">
              O&apos;quvchi
            </p>
            <p className="text-white text-xl font-bold">Imtihonlar</p>
          </div>
        </div>
        <div className="flex items-center justify-center px-6 pt-20">
          <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] w-full max-w-xs">
            <EmptyState
              theme="light"
              icon={<Lock size={28} />}
              title="Imtihon qulflangan"
              description="Imtihon topshirish uchun akademiyaga keling va testerdan ruxsat oling."
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Submitting overlay ───────────────────────────────────────────────────
  if (submitting) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-4">
          <span className="w-10 h-10 border-4 border-[#0d9488]/30 border-t-[#0d9488] rounded-full animate-spin mx-auto block" />
          <p className="text-[#0f172a] font-bold">Topshirilmoqda...</p>
        </div>
      </div>
    );
  }

  // ─── Shared header renderer ───────────────────────────────────────────────
  const examTitle =
    permission.exam?.title ?? permission.lesson?.title ?? 'Imtihon';

  // ─── AI oral exam — separate runner with mic/TTS chat UI ─────────────────
  if (permission.exam && permission.exam.kind === 'ai_oral') {
    // Pass the saved oral-session state (if any) so a refresh after
    // completion lands on the result screen instead of restarting.
    const saved = permission.oralSession;
    const initialResult =
      saved && saved.status === 'completed' && typeof saved.score === 'number'
        ? {
            score: saved.score,
            passed: !!saved.passed,
            analysis: saved.aiAnalysis,
            // No closing line is stored separately — derive a default
            // so the result card has something to show.
            message:
              permission.exam.language === 'uz'
                ? 'Imtihon yakunlandi.'
                : 'Exam ended.',
          }
        : null;
    return (
      <OralExamRunner
        permissionId={permission.id}
        examTitle={examTitle}
        language={(permission.exam.language ?? 'en') as 'uz' | 'en'}
        passThreshold={permission.exam.passThreshold}
        maxMinutes={permission.exam.maxMinutes ?? 10}
        initialResult={initialResult}
      />
    );
  }

  // ─── Catalogue test exam — already-completed result rehydration ──────────
  // For test-kind catalogue exams that the student already finished,
  // ExamPermission carries score + passed but no per-question history.
  // Render a compact result card so the score doesn't disappear on
  // refresh either.
  if (
    permission.exam &&
    permission.exam.kind === 'test' &&
    permission.status !== 'active' &&
    typeof permission.score === 'number'
  ) {
    return (
      <CompletedTestExamResult
        title={examTitle}
        score={permission.score}
        passed={!!permission.passed}
        passThreshold={permission.exam.passThreshold}
      />
    );
  }

  // ─── Legacy lesson-anchored MCQ exam ─────────────────────────────────────
  if (permission.lesson) {
    const allAnswered = legacyAnswers.every((a) => a !== null);
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <ExamHeader
          title={examTitle}
          cameraWarnings={cameraWarnings}
          onLookAway={handleLookAway}
        />
        <div className="px-4 md:px-6 pt-5 pb-8 space-y-4 max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl md:space-y-5">
          {legacyQuestions.length > 0 && (
            <div className="space-y-4">
              {legacyQuestions.map((q, qi) => (
                <div
                  key={qi}
                  className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3"
                >
                  <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">
                    Savol {qi + 1}/{legacyQuestions.length}
                  </p>
                  <p className="text-[#0f172a] font-semibold text-sm">
                    {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const selected = legacyAnswers[qi] === oi;
                      return (
                        <button
                          key={oi}
                          onClick={() =>
                            setLegacyAnswers((prev) => {
                              const n = [...prev];
                              n[qi] = oi;
                              return n;
                            })
                          }
                          className={`w-full text-left px-4 py-3 md:py-4 min-h-[44px] rounded-xl border-[1.5px] text-sm md:text-base font-medium transition-all duration-150 flex items-center gap-3 ${
                            selected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-[#ede9e1] bg-[#f7f4ef] text-[#0f172a] hover:border-[#0f172a]/40 hover:bg-white'
                          }`}
                        >
                          <span className="font-mono text-xs opacity-50 shrink-0">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {legacyQuestions.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[18px] p-4 text-center">
              <p className="text-amber-700 text-sm font-medium">
                Bu imtihonda savollar yo&apos;q. Testerga murojaat qiling.
              </p>
            </div>
          )}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={legacySubmitting}
            disabled={legacySubmitting || !allAnswered}
            icon={<CheckCircle2 size={18} />}
            className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl !py-4"
            onClick={handleLegacySubmit}
          >
            {legacySubmitting
              ? 'Topshirilmoqda...'
              : allAnswered
                ? 'Imtihonni topshirish'
                : `${legacyAnswers.filter((a) => a !== null).length}/${legacyQuestions.length} savol javoblandi`}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Catalogue polymorphic exam ───────────────────────────────────────────
  const sortedQuestions = permission.exam!.questions
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const total = sortedQuestions.length;
  const q = sortedQuestions[currentIdx];

  if (!q) {
    // Edge case: empty question set
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-amber-200 p-8 text-center max-w-sm w-full space-y-4">
          <AlertTriangle size={32} className="text-amber-500 mx-auto" />
          <p className="text-[#0f172a] font-bold">
            Bu imtihonda savollar yo&apos;q.
          </p>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => router.push('/student')}
          >
            Bosh sahifaga
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Sticky header: title + question counter + progress bar */}
      <header className="sticky top-0 z-30 bg-[#0f172a] border-b border-white/10">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#94a3b8] text-[10px] font-semibold uppercase tracking-widest">
                Imtihon
              </p>
              <p className="text-white font-bold text-sm leading-tight truncate">
                {examTitle}
              </p>
            </div>
            <span className="text-white font-extrabold text-sm shrink-0">
              {currentIdx + 1}/{total}
            </span>
          </div>
          {cameraWarnings > 0 && (
            <div className="mt-2 flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 rounded-xl px-3 py-1.5">
              <AlertTriangle size={13} className="text-rose-400" />
              <p className="text-rose-300 text-xs font-semibold">
                Ogohlantirish: {cameraWarnings}/3 — Kameradan uzoqlashmang!
              </p>
            </div>
          )}
        </div>
        {/* Progress bar */}
        <div className="px-4 pb-3">
          <ProgressBar total={total} completed={currentIdx} className="w-full" />
        </div>
      </header>

      <main className="px-4 pt-4 pb-10 space-y-4 max-w-md mx-auto md:max-w-2xl lg:max-w-3xl md:space-y-5">
        {/* Camera monitor */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={14} className="text-[#0d9488]" />
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              Kamera nazorat
            </p>
          </div>
          <CameraMonitor
            onLookAway={handleLookAway}
            onSilenceTooLong={handleLookAway}
          />
        </div>

        {/* No-retry exercise wrapper — key resets the component on each new
            question. onPassed → correct=true, onFailed → correct=false, both
            immediately advance without letting the student retry. */}
        <ExamExercise
          key={`${currentIdx}-${q.type}-${q.id}`}
          question={q}
          onDone={recordAndAdvance}
        />
      </main>
    </div>
  );
}

// ─── Shared header for legacy mode ───────────────────────────────────────────

function ExamHeader({
  title,
  cameraWarnings,
  onLookAway,
}: {
  title: string;
  cameraWarnings: number;
  onLookAway: () => void;
}) {
  return (
    <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-8 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-48 h-48 md:w-72 md:h-72 rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
          transform: 'translate(30%, -30%)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-violet-400" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs">Imtihon</p>
            <p className="text-white font-bold text-base leading-tight">{title}</p>
          </div>
        </div>
        {cameraWarnings > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 rounded-xl px-3 py-2">
            <AlertTriangle size={14} className="text-rose-400" />
            <p className="text-rose-300 text-xs font-semibold">
              Ogohlantirish: {cameraWarnings}/3 — Kameradan uzoqlashmang!
            </p>
          </div>
        )}
        <div className="mt-4 bg-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Camera size={14} className="text-[#0d9488]" />
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">
              Kamera nazorat
            </p>
          </div>
          <CameraMonitor onLookAway={onLookAway} onSilenceTooLong={onLookAway} />
        </div>
      </div>
    </div>
  );
}

// ─── ExamExercise ─────────────────────────────────────────────────────────────

/**
 * Renders one question for the catalogue exam runner. Intercepts
 * `onPassed` / `onFailed` to enforce no-retry: whichever fires first
 * records the correctness and calls `onDone`. After that the parent
 * replaces this component with a fresh key so the child resets.
 *
 * Multi-question exercise types (McqTest, WordOrderTest) receive a
 * single-element array so they advance after just one question.
 */
interface ExamExerciseProps {
  question: ExamQuestion;
  onDone: (correct: boolean) => void;
}

function ExamExercise({ question, onDone }: ExamExerciseProps) {
  // Guard: once onDone fires once, swallow subsequent calls (e.g. auto-advance
  // timers in McqTest that call onPassed after correct flash).
  const done = useRef(false);

  function pass() {
    if (done.current) return;
    done.current = true;
    onDone(true);
  }
  function fail() {
    if (done.current) return;
    done.current = true;
    onDone(false);
  }

  const { type, config } = question;

  switch (type) {
    case 'mcq': {
      // McqTest expects { text, options, correct }[] — map from stored shape
      const cfg = config as {
        question?: string;
        questions?: Array<{ text?: string; options?: string[]; correct?: number }>;
        options?: string[];
        correctIndex?: number;
      };
      let mcqQuestions: { text: string; options: string[]; correct: number }[] = [];
      if (Array.isArray(cfg.questions) && cfg.questions.length > 0) {
        mcqQuestions = cfg.questions
          .filter((q) => q.text && Array.isArray(q.options) && q.options.length > 0)
          .map((q) => ({
            text: q.text!,
            options: q.options!,
            correct: typeof q.correct === 'number' ? q.correct : 0,
          }));
      } else if (cfg.question && Array.isArray(cfg.options)) {
        mcqQuestions = [
          {
            text: cfg.question,
            options: cfg.options,
            correct: typeof cfg.correctIndex === 'number' ? cfg.correctIndex : 0,
          },
        ];
      }
      if (mcqQuestions.length === 0) {
        return <UnsupportedQuestion onSkip={pass} />;
      }
      return (
        <McqTest
          questions={mcqQuestions}
          onPassed={pass}
          onFailed={fail}
        />
      );
    }

    case 'word_order': {
      const cfg = config as {
        sentences?: Array<{ words?: string[]; correct?: string }>;
        words?: string[];
        correct?: string;
      };
      let sentences: { words: string[]; correct: string }[] = [];
      if (Array.isArray(cfg.sentences) && cfg.sentences.length > 0) {
        sentences = cfg.sentences
          .filter((s) => Array.isArray(s.words) && s.words.length > 0 && s.correct)
          .map((s) => ({ words: s.words!, correct: s.correct! }));
      } else if (Array.isArray(cfg.words) && cfg.words.length > 0 && cfg.correct) {
        sentences = [{ words: cfg.words, correct: cfg.correct }];
      }
      if (sentences.length === 0) return <UnsupportedQuestion onSkip={pass} />;
      return (
        <WordOrderTest
          sentences={sentences}
          onPassed={pass}
          onFailed={fail}
        />
      );
    }

    case 'translate': {
      const cfg = config as unknown as TranslateConfig;
      if (!cfg.sourceText || !cfg.correctAnswer) return <UnsupportedQuestion onSkip={pass} />;
      return <TranslateInput config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'fill_blank': {
      const cfg = config as unknown as FillBlankConfig;
      if (!cfg.sentence || !cfg.blank || !cfg.sentence.includes('___'))
        return <UnsupportedQuestion onSkip={pass} />;
      return <FillBlank config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'order_sentences': {
      const cfg = config as unknown as OrderSentencesConfig;
      if (!Array.isArray(cfg.sentences) || cfg.sentences.length < 2)
        return <UnsupportedQuestion onSkip={pass} />;
      return <OrderSentences config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'listen_pick': {
      const cfg = config as unknown as ListenPickConfig;
      if (
        !cfg.text ||
        !Array.isArray(cfg.options) ||
        cfg.options.length < 2 ||
        !cfg.options.some((o) => o?.id === cfg.correctOptionId)
      ) {
        return <UnsupportedQuestion onSkip={pass} />;
      }
      return <ListenPick config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'listen_type': {
      const cfg = config as unknown as ListenTypeConfig;
      if (!cfg.text) return <UnsupportedQuestion onSkip={pass} />;
      return <ListenType config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'spelling': {
      const cfg = config as unknown as SpellingConfig;
      if (!cfg.word || cfg.word.trim().length > 30)
        return <UnsupportedQuestion onSkip={pass} />;
      return <SpellingDrill config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'match_pairs': {
      const cfg = config as unknown as MatchPairsConfig;
      if (
        !Array.isArray(cfg.pairs) ||
        cfg.pairs.length < 2 ||
        !cfg.pairs.every((p) => p.left?.trim() && p.right?.trim())
      ) {
        return <UnsupportedQuestion onSkip={pass} />;
      }
      return <MatchPairs config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'pick_picture': {
      const cfg = config as unknown as PickPictureConfig;
      if (
        !cfg.word ||
        !Array.isArray(cfg.options) ||
        cfg.options.length < 2 ||
        !cfg.options.every((o) => o && typeof o.imageUrl === 'string' && o.imageUrl.length > 0) ||
        !cfg.options.some((o) => o.id === cfg.correctOptionId)
      ) {
        return <UnsupportedQuestion onSkip={pass} />;
      }
      return <PickPicture config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'speak_sentence': {
      const cfg = config as unknown as SpeakSentenceConfig;
      if (!cfg.sentence) return <UnsupportedQuestion onSkip={pass} />;
      return <SpeakSentence config={cfg} onPassed={pass} onFailed={fail} />;
    }

    case 'speak_words': {
      const cfg = config as unknown as SpeakWordsConfig;
      if (!cfg.text) return <UnsupportedQuestion onSkip={pass} />;
      return <SpeakWords config={cfg} onPassed={pass} onFailed={fail} />;
    }

    default:
      return <UnsupportedQuestion onSkip={pass} />;
  }
}

// ─── Fallback for unsupported / malformed questions ───────────────────────────

function UnsupportedQuestion({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="bg-white rounded-[18px] border-[1.5px] border-amber-200 p-6 text-center space-y-3">
      <AlertTriangle size={28} className="text-amber-500 mx-auto" />
      <p className="text-[#0f172a] font-bold text-sm">
        Bu savol turi qo&apos;llab-quvvatlanmaydi yoki noto&apos;g&apos;ri sozlangan.
      </p>
      <Button variant="duo" size="md" onClick={onSkip}>
        Keyingisi
      </Button>
    </div>
  );
}

function CompletedTestExamResult({
  title,
  score,
  passed,
  passThreshold,
}: {
  title: string;
  score: number;
  passed: boolean;
  passThreshold: number;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] p-8 text-center max-w-sm w-full space-y-5">
        <div
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto ${
            passed
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-rose-200 bg-rose-50'
          }`}
        >
          {passed ? (
            <CheckCircle2 size={40} className="text-emerald-500" />
          ) : (
            <XCircle size={40} className="text-rose-500" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
            {title}
          </p>
          <p className="text-2xl font-black text-[#0f172a] mt-1">
            {passed ? "O'tdingiz!" : "O'ta olmadingiz"}
          </p>
          <p className="text-[#64748b] text-sm mt-1">
            {score} / 100{' '}
            <span className="text-xs">({passThreshold}% kerak)</span>
          </p>
        </div>
        <p className="text-[11px] text-[#94a3b8] font-semibold leading-snug">
          Imtihon natijasi 24 soat saqlanadi. Yangi imtihon uchun testerga
          murojaat qiling.
        </p>
      </div>
    </div>
  );
}

