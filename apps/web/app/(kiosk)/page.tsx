'use client';
import { useEffect, useState } from 'react';
import { FaceScanner } from './_components/FaceScanner';
import { AttendanceResult } from './_components/AttendanceResult';

type KioskState = 'loading' | 'scanning' | 'success' | 'manual_login' | 'error';

type FaceCache = {
  embeddings: { user_id: string; name: string; embedding: number[] }[];
  work_start_time: string;
  late_grace_minutes: number;
  generated_at?: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const IDB_DB = 'kiosk_cache';
const IDB_STORE = 'face_cache';
const STALE_HOURS = 48;

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(db: IDBDatabase, key: string): Promise<FaceCache | undefined> {
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as FaceCache | undefined);
    req.onerror = () => resolve(undefined);
  });
}

async function idbPut(db: IDBDatabase, key: string, value: FaceCache): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function isCacheStale(cache: FaceCache): boolean {
  if (!cache.generated_at) return false;
  const ageHours = (Date.now() - new Date(cache.generated_at).getTime()) / 3600000;
  return ageHours > STALE_HOURS;
}

export default function KioskPage() {
  const [kioskState, setKioskState] = useState<KioskState>('loading');
  const [cache, setCache] = useState<FaceCache>({
    embeddings: [],
    work_start_time: '09:00',
    late_grace_minutes: 5,
  });
  const [loadError, setLoadError] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
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

    async function loadCache() {
      let db: IDBDatabase | null = null;
      try {
        db = await openIdb();
      } catch {
        // IndexedDB unavailable — proceed network-only
      }

      try {
        const res = await fetch(`${BASE_URL}/face/cache/${branchId}`, {
          headers: { 'x-device-token': deviceToken },
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as { message?: string }).message ?? 'Cache yuklanmadi');
        }
        const data = (await res.json()) as FaceCache;
        if (db) await idbPut(db, branchId, data);
        setCache(data);
        setKioskState('scanning');
        return;
      } catch {
        // Network failed — try IDB fallback
        if (db) {
          const cached = await idbGet(db, branchId);
          if (cached) {
            setIsOffline(true);
            if (isCacheStale(cached)) setIsStale(true);
            setCache(cached);
            setKioskState('scanning');
            return;
          }
        }
        setLoadError("Tarmoq yo'q va kesh ham mavjud emas. Internetga ulaning.");
        setKioskState('error');
      }
    }

    loadCache();
  }, []);

  async function handleMatched(userId: string, name: string, isLate: boolean, minutes: number) {
    const deviceToken = localStorage.getItem('deviceToken') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/face/face-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deviceToken }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = (json as { message?: string }).message ?? '';
        if (res.status === 409 || msg.toLowerCase().includes('allaqachon')) {
          setLoadError(`${name}: Bugun allaqachon belgilangansiz`);
          setTimeout(() => { setLoadError(''); setKioskState('scanning'); }, 3000);
          return;
        }
        throw new Error(msg || "Belgilab bo'lmadi");
      }
      const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      setResult({ name, time, isLate, minutes });
      setKioskState('success');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Xato');
      setTimeout(() => { setLoadError(''); setKioskState('scanning'); }, 3000);
    }
  }

  function resetToScanning() {
    setResult(null);
    setManualLogin('');
    setManualPassword('');
    setManualError('');
    setKioskState('scanning');
  }

  async function handleManualLogin(e: React.FormEvent) {
    e.preventDefault();
    const deviceToken = localStorage.getItem('deviceToken') ?? '';
    setManualLoading(true);
    setManualError('');
    try {
      const res = await fetch(`${BASE_URL}/face/manual-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: manualLogin, password: manualPassword, deviceToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { message?: string }).message ?? 'Xato');
      const r = json as { name: string; isLate: boolean };
      const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      setResult({ name: r.name, time, isLate: r.isLate, minutes: 0 });
      setKioskState('success');
    } catch (err: unknown) {
      setManualError(err instanceof Error ? err.message : 'Xato');
    } finally {
      setManualLoading(false);
    }
  }

  if (kioskState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p className="text-lg animate-pulse">Yuklanmoqda...</p>
      </div>
    );
  }

  if (kioskState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6 text-center">
        <div className="space-y-4">
          <p className="text-4xl">⚠️</p>
          <p className="text-lg font-medium">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-gray-900 px-6 py-2 rounded-xl font-medium"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  if (kioskState === 'success' && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <AttendanceResult
          name={result.name}
          time={result.time}
          isLate={result.isLate}
          lateMinutes={result.minutes}
          onDone={resetToScanning}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-6 p-4">
      <h1 className="text-2xl font-bold text-center">A&apos;lochi — Xodimlar Kirishi</h1>

      {isOffline && (
        <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-xl px-4 py-2 text-yellow-300 text-sm text-center">
          📴 Offline rejim — {isStale ? '⚠️ Kesh eskirgan (2+ kun)' : 'Lokal kesh ishlatilmoqda'}
        </div>
      )}

      {loadError && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-xl px-4 py-2 text-red-300 text-sm text-center">
          {loadError}
        </div>
      )}

      {kioskState === 'scanning' && (
        <>
          <FaceScanner
            cachedEmbeddings={cache.embeddings}
            workStartTime={cache.work_start_time}
            lateGraceMinutes={cache.late_grace_minutes}
            onMatched={handleMatched}
            onFailed={() => setKioskState('manual_login')}
          />
          <button
            onClick={() => setKioskState('manual_login')}
            className="text-gray-400 text-sm underline"
          >
            🔑 Login bilan kirish
          </button>
        </>
      )}

      {kioskState === 'manual_login' && (
        <form onSubmit={handleManualLogin} className="w-full max-w-sm space-y-4">
          <input
            value={manualLogin}
            onChange={(e) => setManualLogin(e.target.value)}
            placeholder="Login"
            autoComplete="username"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="password"
            value={manualPassword}
            onChange={(e) => setManualPassword(e.target.value)}
            placeholder="Parol"
            autoComplete="current-password"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {manualError && <p className="text-red-400 text-sm text-center">{manualError}</p>}
          <button
            type="submit"
            disabled={manualLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {manualLoading ? 'Kirish...' : 'Kirish'}
          </button>
          <button
            type="button"
            onClick={() => setKioskState('scanning')}
            className="w-full text-gray-400 text-sm"
          >
            ← Yuz aniqlashga qaytish
          </button>
        </form>
      )}
    </div>
  );
}
