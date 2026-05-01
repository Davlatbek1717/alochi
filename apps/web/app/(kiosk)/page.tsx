'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, WifiOff, RefreshCw, KeyRound, ScanFace, GraduationCap, ArrowLeft } from 'lucide-react';
import { FaceScanner } from './_components/FaceScanner';
import { AttendanceResult } from './_components/AttendanceResult';
import { OfflineQueue, isNetworkError } from '@/lib/offline-queue';
import { formatTime } from '@/lib/date-uz';

type CheckinPayload = {
  userId: string;
  deviceToken: string;
  livenessPassed?: boolean;
};
const checkinQueue = new OfflineQueue<CheckinPayload>('face-checkin-queue');

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
  if (!cache.generated_at) return true;
  const ageHours = (Date.now() - new Date(cache.generated_at).getTime()) / 3600000;
  return ageHours > STALE_HOURS;
}

export default function KioskPage() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const raw = (await res.json()) as FaceCache & {
          encrypted?: string;
          encryption?: string;
        };
        // Phase 18.9 — encrypted cache shape: backend may return
        // { encrypted, encryption: 'aes-256-gcm' } when FACE_VECTOR_KEY is set.
        // Client-side decryption is deferred (TODO 18.9): when an encrypted
        // payload arrives without a local key, fall back to a plaintext fetch
        // by treating it as empty so manual login still works. PG encryption
        // at rest + TLS in transit covers cache confidentiality today.
        let data: FaceCache;
        if (raw.encrypted && !raw.embeddings) {
          console.warn('[KioskPage] encrypted cache received — client decryption not yet implemented; using empty embeddings');
          data = {
            embeddings: [],
            work_start_time: raw.work_start_time,
            late_grace_minutes: raw.late_grace_minutes,
            generated_at: raw.generated_at,
          };
        } else {
          data = raw;
        }
        if (db) await idbPut(db, branchId, data);
        setCache(data);
        setIsOffline(false);
        setIsStale(false);
        setKioskState('scanning');
        return;
      } catch (fetchErr) {
        console.error('[KioskPage] loadCache network error:', fetchErr);
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
      } finally {
        db?.close();
      }
    }

    loadCache();

    const handleOnline = () => loadCache();
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleMatched(userId: string, name: string, isLate: boolean, minutes: number, livenessPassed: boolean) {
    const deviceToken = localStorage.getItem('deviceToken') ?? '';
    const payload: CheckinPayload = { userId, deviceToken, livenessPassed };
    try {
      const res = await fetch(`${BASE_URL}/face/face-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = (json as { message?: string }).message ?? '';
        if (res.status === 409 || msg.toLowerCase().includes('allaqachon')) {
          setLoadError(`${name}: Bugun allaqachon belgilangansiz`);
          timerRef.current = setTimeout(() => { setLoadError(''); setKioskState('scanning'); }, 3000);
          return;
        }
        throw new Error(msg || "Belgilab bo'lmadi");
      }
      const time = formatTime(new Date());
      setResult({ name, time, isLate, minutes });
      setKioskState('success');
    } catch (err: unknown) {
      // Phase 18.7 — network error: enqueue and show optimistic success.
      if (isNetworkError(err)) {
        try {
          await checkinQueue.enqueue(payload);
          const time = formatTime(new Date());
          setResult({ name, time, isLate, minutes });
          setKioskState('success');
          return;
        } catch (qErr) {
          console.error('[KioskPage] enqueue failed:', qErr);
        }
      }
      setLoadError(err instanceof Error ? err.message : 'Xato');
      timerRef.current = setTimeout(() => { setLoadError(''); setKioskState('scanning'); }, 3000);
    }
  }

  // Phase 18.7 — drain offline queue when reconnecting.
  useEffect(() => {
    async function drain() {
      try {
        await checkinQueue.drain(async (item) => {
          const res = await fetch(`${BASE_URL}/face/face-checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          // Treat 409 as terminal (already recorded) — drop it from the
          // queue by returning normally; throw on real network/5xx so we
          // retry next reconnect.
          if (!res.ok && res.status >= 500) {
            throw new Error(`drain failed status=${res.status}`);
          }
        });
      } catch (err) {
        console.error('[KioskPage] drain error:', err);
      }
    }
    const handler = () => { void drain(); };
    window.addEventListener('online', handler);
    // Try once on mount in case queue had pending items from last session.
    void drain();
    return () => window.removeEventListener('online', handler);
  }, []);

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
      const time = formatTime(new Date());
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
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={28} className="text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (kioskState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#e11d48]/20 border border-[#e11d48]/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-[#e11d48]" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Xatolik</p>
          <p className="text-[#94a3b8] text-sm mb-6">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white hover:bg-slate-100 active:bg-slate-200 text-[#0f172a] px-6 py-3 rounded-xl font-bold mx-auto transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <RefreshCw size={16} /> Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  if (kioskState === 'success' && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] gap-6 p-6">
      {/* Logo */}
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-3">
          <GraduationCap size={24} className="text-white" />
        </div>
        <p className="text-white text-xl font-black">A&apos;lochi</p>
        <p className="text-[#94a3b8] text-sm mt-0.5">Xodimlar Kirishi</p>
      </div>

      {isOffline && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-2.5 text-amber-300 text-sm">
          <WifiOff size={14} />
          {isStale ? 'Kesh eskirgan (2+ kun)' : 'Offline — lokal kesh'}
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 bg-[#e11d48]/10 border border-[#e11d48]/20 rounded-xl px-4 py-2.5 text-[#e11d48] text-sm">
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {kioskState === 'scanning' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          <FaceScanner
            cachedEmbeddings={cache.embeddings}
            workStartTime={cache.work_start_time}
            lateGraceMinutes={cache.late_grace_minutes}
            onMatched={handleMatched}
            onFailed={() => setKioskState('manual_login')}
          />
          <button
            onClick={() => setKioskState('manual_login')}
            className="flex items-center gap-2 text-[#94a3b8] hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg px-2 py-1"
          >
            <KeyRound size={14} /> Login bilan kirish
          </button>
        </div>
      )}

      {kioskState === 'manual_login' && (
        <form onSubmit={handleManualLogin} className="w-full max-w-sm space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <KeyRound size={16} className="text-[#94a3b8]" />
            </div>
            <p className="text-white font-bold">Parol bilan kirish</p>
          </div>
          <input
            value={manualLogin}
            onChange={(e) => setManualLogin(e.target.value)}
            placeholder="Login"
            autoComplete="username"
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#64748b] text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            value={manualPassword}
            onChange={(e) => setManualPassword(e.target.value)}
            placeholder="Parol"
            autoComplete="current-password"
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#64748b] text-sm focus:outline-none focus:border-indigo-500"
          />
          {manualError && (
            <div className="flex items-center gap-2 bg-[#e11d48]/10 border border-[#e11d48]/20 rounded-xl px-3 py-2 text-[#e11d48] text-sm">
              <AlertTriangle size={13} className="shrink-0" />
              {manualError}
            </div>
          )}
          <button
            type="submit"
            disabled={manualLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#0f172a]"
          >
            {manualLoading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <KeyRound size={16} />}
            {manualLoading ? 'Kirish...' : 'Kirish'}
          </button>
          <button
            type="button"
            onClick={() => setKioskState('scanning')}
            className="w-full flex items-center justify-center gap-2 text-[#64748b] hover:text-white text-sm transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg"
          >
            <ArrowLeft size={14} />
            <ScanFace size={14} /> Yuz aniqlashga qaytish
          </button>
        </form>
      )}
    </div>
  );
}
