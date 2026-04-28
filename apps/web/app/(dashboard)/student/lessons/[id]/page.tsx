'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, RefreshCw, BookOpen } from 'lucide-react';
import { VideoPlayer } from './_components/VideoPlayer';
import { McqTest } from './_components/McqTest';
import { WordOrderTest } from './_components/WordOrderTest';
import { AiTutor } from './_components/AiTutor';
import { CameraMonitor } from './_components/CameraMonitor';
import { apiRequest } from '@/lib/api';

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
  components: ComponentFlags;
  components_data: LessonComponent[];
};

type ProgressEntry = {
  lessonId: string;
  sessionCount: number;
  homeCompleted: boolean;
  academyCompleted: boolean;
};

type Step = 'video' | 'mcq' | 'word_order' | 'ai_tutor' | 'academy' | 'done';

function buildSteps(components: ComponentFlags): Step[] {
  const steps: Step[] = ['video'];
  if (components.mcq) steps.push('mcq');
  if (components.word_order) steps.push('word_order');
  if (components.ai_tutor) steps.push('ai_tutor');
  if (components.camera) steps.push('academy');
  steps.push('done');
  return steps;
}

const STEP_LABELS: Record<Step, string> = {
  video: 'Video',
  mcq: 'Test',
  word_order: "So'z",
  ai_tutor: 'AI',
  academy: 'Akademiya',
  done: 'Tayyor',
};

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<ProgressEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('video');
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [lessonRes, progressRes] = await Promise.all([
          apiRequest<Lesson>(`/lessons/${id}`, {}, token),
          apiRequest<ProgressEntry[]>('/progress/my', {}, token),
        ]);
        setLesson(lessonRes.data);
        const myProgress = progressRes.data.find((p) => p.lessonId === id) ?? null;
        setProgress(myProgress);
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
      const progressRes = await apiRequest<ProgressEntry[]>('/progress/my', {}, token);
      const updated = progressRes.data.find((p) => p.lessonId === lesson.id);
      if (updated) setProgress(updated);
      setStep('done');
    } catch {
      setSessionError(true);
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
        return { text: cfg.question, options: cfg.options, correct: cfg.correctIndex };
      });
  }

  function getWordOrderSentences() {
    if (!lesson) return [];
    return lesson.components_data
      .filter((c) => c.type === 'word_order')
      .map((c) => {
        const cfg = c.config as WordOrderConfig;
        return { words: cfg.words, correct: cfg.correct };
      });
  }

  function goToNextStep() {
    if (!lesson) return;
    const steps = buildSteps(lesson.components);
    const idx = steps.indexOf(step);
    if (idx + 1 < steps.length) {
      setStep(steps[idx + 1]);
    }
  }

  function restartCycle() {
    setStep('video');
    setVideoCompleted(false);
  }

  async function handleCycleComplete() {
    await completeSession();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <p className="text-[#64748b]">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-4">
        <p className="text-[#e11d48]">{error || 'Dars topilmadi'}</p>
      </div>
    );
  }

  const steps = buildSteps(lesson.components);
  const currentStepIndex = steps.indexOf(step);
  const mcqQuestions = getMcqQuestions();
  const wordOrderSentences = getWordOrderSentences();
  const visibleSteps = steps.filter((s) => s !== 'done');

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#94a3b8] mb-3 text-sm">
            <ArrowLeft size={16} /> Orqaga
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-[#0d9488]" />
              </div>
              <p className="text-white font-bold text-base leading-tight">{lesson.title}</p>
            </div>
            {progress && (
              <span className="text-xs text-[#64748b] bg-white/5 border border-white/10 px-2 py-1 rounded-lg shrink-0 font-mono">
                {progress.sessionCount}/{lesson.nRepetitions}
              </span>
            )}
          </div>

          {/* Step progress */}
          <div className="flex gap-1 mt-4">
            {visibleSteps.map((s, i) => (
              <div key={s} className="flex-1 relative">
                <div className={`h-1.5 rounded-full ${
                  i < currentStepIndex ? 'bg-[#0d9488]' :
                  i === currentStepIndex ? 'bg-[#f59e0b]' :
                  'bg-white/10'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {visibleSteps.map((s, i) => (
              <p key={s} className={`text-[10px] font-medium ${
                i === currentStepIndex ? 'text-[#f59e0b]' : i < currentStepIndex ? 'text-[#0d9488]' : 'text-white/20'
              }`}>
                {STEP_LABELS[s]}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4">
        {step === 'video' && (
          <div className="space-y-4">
            <VideoPlayer
              youtubeUrl={lesson.youtubeUrl}
              onCompleted={() => setVideoCompleted(true)}
            />
            {videoCompleted ? (
              <button
                onClick={goToNextStep}
                className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                Davom etish <ArrowLeft size={16} className="rotate-180" />
              </button>
            ) : (
              <p className="text-center text-[#94a3b8] text-sm">
                Davom etish uchun videoni ko&apos;ring
              </p>
            )}
          </div>
        )}

        {step === 'mcq' && mcqQuestions.length > 0 && (
          <McqTest
            questions={mcqQuestions}
            onPassed={goToNextStep}
            onFailed={restartCycle}
          />
        )}

        {step === 'mcq' && mcqQuestions.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[#94a3b8] text-sm">MCQ savollar topilmadi</p>
            <button onClick={goToNextStep} className="mt-2 text-[#0d9488] text-sm underline font-semibold">
              Davom etish
            </button>
          </div>
        )}

        {step === 'word_order' && wordOrderSentences.length > 0 && (
          <WordOrderTest
            sentences={wordOrderSentences}
            onPassed={goToNextStep}
            onFailed={restartCycle}
          />
        )}

        {step === 'word_order' && wordOrderSentences.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[#94a3b8] text-sm">So&apos;z tartibi topshiriqlari topilmadi</p>
            <button onClick={goToNextStep} className="mt-2 text-[#0d9488] text-sm underline font-semibold">
              Davom etish
            </button>
          </div>
        )}

        {step === 'ai_tutor' && (
          <AiTutor
            lessonContext={lesson.title}
            onCompleted={goToNextStep}
          />
        )}

        {step === 'academy' && (
          <div className="space-y-4">
            <CameraMonitor
              onLookAway={restartCycle}
              onSilenceTooLong={restartCycle}
            />
            {sessionError && (
              <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 rounded-[18px] p-4 space-y-2">
                <p className="text-[#e11d48] text-sm font-semibold">
                  Sessiyani saqlashda xato yuz berdi. Qayta urinib ko&apos;ring.
                </p>
                <button
                  onClick={completeSession}
                  disabled={completing}
                  className="w-full bg-[#e11d48] text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                >
                  {completing ? 'Saqlanmoqda...' : 'Qayta urinish'}
                </button>
              </div>
            )}
            {!sessionError && (
              <button
                onClick={handleCycleComplete}
                disabled={completing}
                className="w-full bg-emerald-500 text-white py-4 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                {completing ? 'Saqlanmoqda...' : 'Topshirish — Sessiyani yakunlash'}
              </button>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-[#0f172a]">Sessiya yakunlandi!</h2>
            <p className="text-[#64748b] text-sm">
              {progress
                ? `${progress.sessionCount}/${lesson.nRepetitions} sessiya bajarildi`
                : 'Jarayoningiz saqlandi'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={restartCycle}
                className="flex items-center gap-2 bg-[#0f172a] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#1e293b] transition-colors"
              >
                <RefreshCw size={16} /> Yana bir bor
              </button>
              <button
                onClick={() => router.push('/student/lessons')}
                className="bg-[#f7f4ef] border border-[#ede9e1] text-[#0f172a] px-6 py-3 rounded-xl font-bold text-sm"
              >
                Darslar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
