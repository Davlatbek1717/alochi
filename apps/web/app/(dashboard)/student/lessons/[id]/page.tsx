'use client';
import { useState } from 'react';
import { VideoPlayer } from './_components/VideoPlayer';

const MOCK_LESSON = {
  id: '1',
  title: 'Present Simple',
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
  nRepetitions: 3,
};

type Step = 'video' | 'tests' | 'academy';

export default function LessonPage() {
  const [step, setStep] = useState<Step>('video');
  const [videoCompleted, setVideoCompleted] = useState(false);

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">{MOCK_LESSON.title}</h1>
      </div>

      <div className="flex gap-2">
        {(['video', 'tests', 'academy'] as Step[]).map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${
              step === s ? 'bg-indigo-600' :
              (step === 'tests' && s === 'video') || (step === 'academy') ? 'bg-green-400' :
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
              onClick={() => setStep('tests')}
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

      {step === 'tests' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Testlar</h2>
          <p className="text-gray-500">MCQ va so&apos;z tartibi testlari Task 7 da qo&apos;shiladi.</p>
          <button
            onClick={() => setStep('academy')}
            className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
          >
            Davom etish → Akademiya
          </button>
        </div>
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
