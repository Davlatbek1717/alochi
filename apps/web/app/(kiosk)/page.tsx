'use client';
import { useEffect, useState } from 'react';
import { FaceScanner } from './_components/FaceScanner';
import { AttendanceResult } from './_components/AttendanceResult';

type KioskState = 'loading' | 'scanning' | 'success' | 'manual_login' | 'error';

type FaceCache = {
  embeddings: { user_id: string; name: string; embedding: number[] }[];
  work_start_time: string;
  late_grace_minutes: number;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function KioskPage() {
  const [kioskState, setKioskState] = useState<KioskState>('loading');
  const [cache, setCache] = useState<FaceCache>({
    embeddings: [],
    work_start_time: '09:00',
    late_grace_minutes: 5,
  });
  const [loadError, setLoadError] = useState('');
  const [result, setResult] = useState<{
    name: string; time: string; isLate: boolean; minutes: number;
  } | null>(null);
  const [manualLogin, setManualLogin] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  useEffect(() => {
    const deviceToken = localStorage.getItem('deviceToken') ?? '';
    const branchId = localStorage.getItem('branchId') ?? '';

    if (!deviceToken || !branchId) {
      setLoadError("Qurilma sozlanmagan. 'deviceToken' va 'branchId' kerak.");
      setKioskState('error');
      return;
    }

    fetch(`${BASE_URL}/face/cache/${branchId}`, {
      headers: { 'x-device-token': deviceToken },
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as { message?: string }).message ?? 'Cache yuklanmadi');
        }
        return res.json() as Promise<FaceCache>;
      })
      .then((data) => {
        setCache(data);
        setKioskState('scanning');
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Cache yuklanmadi');
        setKioskState('error');
      });
  }, []);

  async function handleMatched(userId: string, name: string, isLate: boolean, minutes: number) {
    const deviceToken = localStorage.getItem('deviceToken') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/face/face-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deviceToken }),
      });
      const json = await res.json() as { isLate?: boolean };
      const now = new Date();
      setResult({
        name,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        isLate: json.isLate ?? isLate,
        minutes,
      });
    } catch {
      const now = new Date();
      setResult({
        name,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        isLate,
        minutes,
      });
    }
    setKioskState('success');
  }

  async function handleManualLogin() {
    setManualError('');
    if (!manualLogin.trim() || !manualPassword.trim()) {
      setManualError('Login va parolni kiriting');
      return;
    }
    setManualLoading(true);
    const deviceToken = localStorage.getItem('deviceToken') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/face/manual-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: manualLogin, password: manualPassword, deviceToken }),
      });
      const json = await res.json() as { name?: string; isLate?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Xato');
      const now = new Date();
      setResult({
        name: json.name ?? manualLogin,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        isLate: json.isLate ?? false,
        minutes: 0,
      });
      setKioskState('success');
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Xato');
    } finally {
      setManualLoading(false);
    }
  }

  function resetToScanning() {
    setResult(null);
    setManualLogin('');
    setManualPassword('');
    setManualError('');
    setKioskState('scanning');
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">🏫 A&apos;lochi</h1>
        <p className="text-white/60 text-sm">Xodimlar Kirishi</p>
      </div>

      {kioskState === 'loading' && (
        <p className="text-white/60">Yuklanmoqda...</p>
      )}

      {kioskState === 'error' && (
        <div className="bg-red-500/20 border border-red-400/40 rounded-2xl p-6 w-full max-w-sm text-center">
          <p className="text-white text-sm">{loadError}</p>
          <button
            onClick={() => { setLoadError(''); setKioskState('manual_login'); }}
            className="mt-3 text-white/70 underline text-sm"
          >
            Qo&apos;lda kirish
          </button>
        </div>
      )}

      {kioskState === 'scanning' && (
        <FaceScanner
          cachedEmbeddings={cache.embeddings}
          workStartTime={cache.work_start_time}
          lateGraceMinutes={cache.late_grace_minutes}
          onMatched={handleMatched}
          onFailed={() => setKioskState('manual_login')}
        />
      )}

      {kioskState === 'success' && result && (
        <AttendanceResult
          name={result.name}
          time={result.time}
          isLate={result.isLate}
          lateMinutes={result.minutes}
          onDone={resetToScanning}
        />
      )}

      {kioskState === 'manual_login' && (
        <div className="bg-white/10 rounded-2xl p-6 space-y-4 w-full max-w-sm backdrop-blur-sm">
          <p className="text-white text-center font-semibold">🔑 Login bilan kirish</p>
          {manualError && (
            <p className="text-red-300 text-sm text-center">{manualError}</p>
          )}
          <input
            type="text"
            value={manualLogin}
            onChange={(e) => setManualLogin(e.target.value)}
            placeholder="Login"
            className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2"
          />
          <input
            type="password"
            value={manualPassword}
            onChange={(e) => setManualPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualLogin()}
            placeholder="Parol"
            className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded-lg px-3 py-2"
          />
          <button
            onClick={handleManualLogin}
            disabled={manualLoading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {manualLoading ? 'Tekshirilmoqda...' : 'Kirish'}
          </button>
        </div>
      )}

      {(kioskState === 'success' || kioskState === 'manual_login') && (
        <button onClick={resetToScanning} className="text-white/50 text-sm underline">
          ← Qaytish
        </button>
      )}
    </div>
  );
}
