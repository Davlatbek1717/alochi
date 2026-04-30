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

  // Phase 21.2: after 3 consecutive Azure speech failures we fall back to a
  // text-input flow so the user can still progress.
  const [azureFails, setAzureFails] = useState(0);
  const [audioMode, setAudioMode] = useState(true);
  const [textAnswer, setTextAnswer] = useState('');

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
      setAzureFails(0); // success → reset counter
    } catch (err) {
      setPermError(err instanceof Error ? err.message : 'Yuborishda xato yuz berdi');
      setAzureFails((c) => {
        const next = c + 1;
        // After 3 consecutive Azure failures, switch to text-input fallback.
        if (next >= 3) setAudioMode(false);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function submitTextAnswer() {
    const trimmed = textAnswer.trim();
    if (!trimmed) return;
    // Simple local match: case-insensitive equality with the target word.
    // Server-side validation can be added later; this unblocks the user when
    // the speech pipeline is unreachable.
    const ok = trimmed.toLowerCase() === word.toLowerCase();
    setScore(ok ? 100 : 50);
    setPermError('');
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

      {!audioMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-amber-700 text-sm">
            Ovoz aniqlanmadi. Iltimos, javobni yozing.
          </p>
        </div>
      )}

      {scoreDisplay && (
        <div className={`rounded-xl p-3 border text-center ${scoreDisplay.bg}`}>
          <p className={`font-semibold ${scoreDisplay.color}`}>{scoreDisplay.label}</p>
        </div>
      )}

      {audioMode ? (
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
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="So'zni yozing"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
          />
          <button
            onClick={submitTextAnswer}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            Yuborish
          </button>
          <button
            onClick={() => {
              setAudioMode(true);
              setAzureFails(0);
              setPermError('');
            }}
            className="text-indigo-600 text-xs underline self-start"
          >
            Ovoz bilan qayta urinish
          </button>
        </div>
      )}
    </div>
  );
}
