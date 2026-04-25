'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
      <div className="max-w-3xl mx-auto py-6 flex items-center justify-center">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="max-w-3xl mx-auto py-6">
        <p className="text-red-500">{error || 'Dars topilmadi'}</p>
      </div>
    );
  }

  const steps = buildSteps(lesson.components);
  const currentStepIndex = steps.indexOf(step);
  const mcqQuestions = getMcqQuestions();
  const wordOrderSentences = getWordOrderSentences();

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Orqaga
        </button>
        <h1 className="text-xl font-bold flex-1">{lesson.title}</h1>
        {progress && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {progress.sessionCount}/{lesson.nRepetitions} sessiya
          </span>
        )}
      </div>

      <div className="flex gap-1">
        {steps.filter((s) => s !== 'done').map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${
              i < currentStepIndex ? 'bg-green-400' :
              i === currentStepIndex ? 'bg-indigo-600' :
              'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {step === 'video' && (
        <div className="space-y-4">
          <VideoPlayer
            youtubeUrl={lesson.youtubeUrl}
            onCompleted={() => setVideoCompleted(true)}
          />
          {videoCompleted ? (
            <button
              onClick={goToNextStep}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
            >
              Davom etish →
            </button>
          ) : (
            <p className="text-center text-gray-500 text-sm">
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
          <p className="text-gray-400 text-sm">MCQ savollar topilmadi</p>
          <button onClick={goToNextStep} className="mt-2 text-indigo-600 text-sm underline">
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
          <p className="text-gray-400 text-sm">So&apos;z tartibi topshiriqlari topilmadi</p>
          <button onClick={goToNextStep} className="mt-2 text-indigo-600 text-sm underline">
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
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-red-600 text-sm font-medium">
                Sessiyani saqlashda xato yuz berdi. Qayta urinib ko&apos;ring.
              </p>
              <button
                onClick={completeSession}
                disabled={completing}
                className="w-full bg-red-600 text-white py-2 rounded-xl font-medium text-sm disabled:opacity-50"
              >
                {completing ? 'Saqlanmoqda...' : 'Qayta urinish'}
              </button>
            </div>
          )}
          {!sessionError && (
            <button
              onClick={handleCycleComplete}
              disabled={completing}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50"
            >
              {completing ? 'Saqlanmoqda...' : '✅ Topshirish — Sessiyani yakunlash'}
            </button>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
          <p className="text-5xl">🎉</p>
          <h2 className="text-xl font-bold text-gray-800">Sessiya yakunlandi!</h2>
          <p className="text-gray-500 text-sm">
            {progress
              ? `${progress.sessionCount}/${lesson.nRepetitions} sessiya bajarildi`
              : 'Jarayoningiz saqlandi'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={restartCycle}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium"
            >
              🔄 Yana bir bor
            </button>
            <button
              onClick={() => router.push('/student/lessons')}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl font-medium"
            >
              ← Darslar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
