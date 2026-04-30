'use client';
import { useRef, useState } from 'react';

type VocabularyAudioProps = {
  word: string;
  lessonId: string;
};

type ScoreResult = {
  score: number;
};

export default function VocabularyAudio({ word, lessonId }: VocabularyAudioProps) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [permError, setPermError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setPermError('');
    setScore(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await submitAudio(audioBlob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermError('Mikrofon ruxsati berilmadi. Brauzer sozlamalarida ruxsat bering.');
      } else {
        setPermError('Mikrofonga ulanishda xato yuz berdi.');
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setLoading(true);
    }
  }

  async function submitAudio(audioBlob: Blob) {
    const token = localStorage.getItem('accessToken') ?? '';
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('word', word);
      formData.append('lessonId', lessonId);

      const res = await fetch(`${BASE_URL}/ai/speech/assess`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json() as ScoreResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Xato yuz berdi');
      setScore(json.score ?? 0);
    } catch (err) {
      setPermError(err instanceof Error ? err.message : 'Yuborishda xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  function getScoreDisplay() {
    if (score === null) return null;
    if (score >= 80) {
      return {
        label: `Ajoyib! ${score}/100`,
        color: 'text-green-600',
        bg: 'bg-green-50 border-green-200',
      };
    }
    if (score >= 60) {
      return {
        label: `Yaxshi ${score}/100`,
        color: 'text-yellow-600',
        bg: 'bg-yellow-50 border-yellow-200',
      };
    }
    return {
      label: `Qayta urinib ko'ring ${score}/100`,
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200',
    };
  }

  const scoreDisplay = getScoreDisplay();

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
      <div className="text-center">
        <p className="text-xs text-gray-500 mb-1">Talaffuz qiling:</p>
        <p className="text-2xl font-bold text-indigo-600">{word}</p>
      </div>

      {permError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-600 text-sm">{permError}</p>
        </div>
      )}

      {scoreDisplay && (
        <div className={`rounded-xl p-3 border text-center ${scoreDisplay.bg}`}>
          <p className={`font-semibold ${scoreDisplay.color}`}>{scoreDisplay.label}</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        {recording && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-red-500 font-medium">Yozib olinmoqda...</span>
          </div>
        )}

        {loading && (
          <p className="text-sm text-gray-500">Tekshirilmoqda...</p>
        )}

        {!recording && !loading && (
          <button
            onClick={startRecording}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            🎤 Yozib olish
          </button>
        )}

        {recording && (
          <button
            onClick={stopRecording}
            className="bg-red-500 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-red-600 transition-colors"
          >
            ⏹️ To&apos;xtatish
          </button>
        )}
      </div>
    </div>
  );
}
