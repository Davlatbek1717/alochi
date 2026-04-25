'use client';
import { useState } from 'react';
import { FaceScanner } from './_components/FaceScanner';
import { AttendanceResult } from './_components/AttendanceResult';

type KioskState = 'scanning' | 'success' | 'manual_login';

const DEMO_CACHE = {
  embeddings: [] as { user_id: string; name: string; embedding: number[] }[],
  work_start_time: '09:00',
  late_grace_minutes: 5,
};

export default function KioskPage() {
  const [state, setState] = useState<KioskState>('scanning');
  const [result, setResult] = useState<{
    name: string; time: string; isLate: boolean; minutes: number;
  } | null>(null);

  function handleMatched(userId: string, name: string, isLate: boolean, minutes: number) {
    void userId;
    const now = new Date();
    setResult({
      name,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      isLate,
      minutes,
    });
    setState('success');
  }

  function resetToScanning() {
    setResult(null);
    setState('scanning');
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">🏫 A&apos;lochi</h1>
        <p className="text-white/60 text-sm">Xodimlar Kirishi</p>
      </div>

      {state === 'scanning' && (
        <FaceScanner
          cachedEmbeddings={DEMO_CACHE.embeddings}
          workStartTime={DEMO_CACHE.work_start_time}
          lateGraceMinutes={DEMO_CACHE.late_grace_minutes}
          onMatched={handleMatched}
          onFailed={() => setState('manual_login')}
        />
      )}

      {state === 'success' && result && (
        <AttendanceResult
          name={result.name}
          time={result.time}
          isLate={result.isLate}
          lateMinutes={result.minutes}
          onDone={resetToScanning}
        />
      )}

      {state === 'manual_login' && (
        <div className="bg-white/10 rounded-2xl p-6 space-y-4 w-full max-w-sm backdrop-blur-sm">
          <p className="text-white text-center">🔑 Login bilan kirish</p>
          <input
            type="text"
            placeholder="Login"
            className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2"
          />
          <input
            type="password"
            placeholder="Parol"
            className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2"
          />
          <button
            onClick={resetToScanning}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg"
          >
            Kirish
          </button>
        </div>
      )}

      {state !== 'scanning' && (
        <button onClick={resetToScanning} className="text-white/50 text-sm underline">
          ← Qaytish
        </button>
      )}
    </div>
  );
}
