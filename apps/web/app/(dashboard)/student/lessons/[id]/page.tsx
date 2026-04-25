'use client';
import { useState } from 'react';
import { VideoPlayer } from './_components/VideoPlayer';
import { McqTest } from './_components/McqTest';
import { WordOrderTest } from './_components/WordOrderTest';
import { AiTutor } from './_components/AiTutor';

const MOCK_LESSON = {
  id: '1',
  title: 'Present Simple',
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
  nRepetitions: 3,
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
  const [step, setStep] = useState<Step>('video');
  const [videoCompleted, setVideoCompleted] = useState(false);

  const steps: Step[] = ['video', 'mcq', 'word_order', 'ai_tutor', 'academy'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <h1 className="text-xl font-bold">{MOCK_LESSON.title}</h1>

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
            youtubeUrl={MOCK_LESSON.youtubeUrl}
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
          lessonContext={MOCK_LESSON.title}
          onCompleted={() => setStep('academy')}
        />
      )}

      {step === 'academy' && (
        <div className="bg-green-50 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">🎓</div>
          <h2 className="font-bold text-lg">Akademiyaga boring!</h2>
          <p className="text-gray-600">Uy qismi tugadi. Tester siz kelganizda belgilaydi.</p>
        </div>
      )}
    </div>
  );
}
