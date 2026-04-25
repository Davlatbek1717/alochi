'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { VideoPlayer } from './_components/VideoPlayer';
import { McqTest } from './_components/McqTest';
import { WordOrderTest } from './_components/WordOrderTest';
import { AiTutor } from './_components/AiTutor';
import { CameraMonitor } from './_components/CameraMonitor';
import { apiRequest } from '@/lib/api';

type Lesson = {
  id: string;
  title: string;
  youtubeUrl: string;
  nRepetitions: number;
};

const MOCK_MCQ = [
  { text: 'What is "apple" in Uzbek?', options: ['Olma', 'Nok', 'Uzum', 'Limon'], correct: 0 },
  { text: '"She ___ English."', options: ['speak', 'speaks', 'speaking', 'spoke'], correct: 1 },
];

const MOCK_WORD_ORDER = [
  { words: ['a', 'student', 'am', 'I'], correct: 'I am a student' },
  { words: ['English', 'speaks', 'She'], correct: 'She speaks English' },
];

type Step = 'video' | 'mcq' | 'word_order' | 'ai_tutor' | 'academy';

export default function LessonPage() {
  const params = useParams();
  const id = params?.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('video');
  const [videoCompleted, setVideoCompleted] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchLesson() {
      try {
        const res = await apiRequest<Lesson>(`/lessons/${id}`, {}, token);
        setLesson(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dars topilmadi');
      } finally {
        setLoading(false);
      }
    }

    fetchLesson();
  }, [id]);

  const steps: Step[] = ['video', 'mcq', 'word_order', 'ai_tutor', 'academy'];
  const currentStepIndex = steps.indexOf(step);

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

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <h1 className="text-xl font-bold">{lesson.title}</h1>

      <div className="flex gap-2">
        {steps.map((s, i) => (
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
          {videoCompleted && (
            <button
              onClick={() => setStep('mcq')}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
            >
              Davom etish → Testlar
            </button>
          )}
          {!videoCompleted && (
            <p className="text-center text-gray-500 text-sm">
              Davom etish uchun videoni 90% ko&apos;ring
            </p>
          )}
        </div>
      )}

      {step === 'mcq' && (
        <McqTest
          questions={MOCK_MCQ}
          onPassed={() => setStep('word_order')}
          onFailed={() => { setStep('video'); setVideoCompleted(false); }}
        />
      )}

      {step === 'word_order' && (
        <WordOrderTest
          sentences={MOCK_WORD_ORDER}
          onPassed={() => setStep('ai_tutor')}
          onFailed={() => { setStep('video'); setVideoCompleted(false); }}
        />
      )}

      {step === 'ai_tutor' && (
        <AiTutor
          lessonContext={lesson.title}
          onCompleted={() => setStep('academy')}
        />
      )}

      {step === 'academy' && (
        <div className="space-y-4">
          <CameraMonitor
            onLookAway={() => { setStep('video'); setVideoCompleted(false); }}
            onSilenceTooLong={() => { setStep('video'); setVideoCompleted(false); }}
          />
          <p className="text-center text-sm text-gray-500">
            Kamera oldida topshirishingizni kutmoqdamiz...
          </p>
        </div>
      )}
    </div>
  );
}
