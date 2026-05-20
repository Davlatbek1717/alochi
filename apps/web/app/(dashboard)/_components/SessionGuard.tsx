'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

/**
 * Session guard for the student tablet experience.
 *
 * Polls /study-time/gate every 15 s (5 s while locked).
 *  - state 'ok'    → studying; shows a live daily-cap countdown pill
 *                    (top-right) and a break-warning pill in the last
 *                    10 min of the work block.
 *  - state 'break' → full-screen lock with break countdown.
 *                    Saves the current URL so the student resumes
 *                    exactly where they were once the break ends.
 *  - state 'cap'   → daily limit reached; locked until tomorrow.
 *
 * Fail-open: a failed poll never locks the student.
 */

interface Gate {
  state: 'ok' | 'break' | 'cap';
  secondsToday: number;
  dailyCapMinutes: number;
  blockSecondsLeft: number;
  breakEndsAt: string | null;
}

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function hhmmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const RESUME_KEY = 'study_resume_path';

export function SessionGuard() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate | null>(null);
  // Remaining seconds for the daily cap — ticks down 1/s, corrected on each poll.
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const breakEndRef = useRef<number | null>(null);
  const blockEndRef = useRef<number | null>(null);
  const prevStateRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await apiRequest<Gate>('/study-time/gate');
        if (!cancelled) {
          setGate(res.data);
          // Snap remaining to the authoritative server value on every poll.
          if (res.data.dailyCapMinutes > 0) {
            setDailyRemaining(
              Math.max(0, res.data.dailyCapMinutes * 60 - res.data.secondsToday),
            );
          }
          breakEndRef.current = res.data.breakEndsAt
            ? new Date(res.data.breakEndsAt).getTime()
            : null;
          blockEndRef.current =
            res.data.state === 'ok'
              ? Date.now() + res.data.blockSecondsLeft * 1000
              : null;
        }
      } catch {
        // fail-open — never trap the student on a network blip
        if (!cancelled) setGate((g) => g ?? null);
      }
      if (!cancelled) {
        const next =
          breakEndRef.current && Date.now() < breakEndRef.current ? 5000 : 15000;
        timer = setTimeout(poll, next);
      }
    }
    poll();

    const onVis = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Resume: save URL when break starts; navigate back when break ends.
  useEffect(() => {
    if (!gate) return;
    const prev = prevStateRef.current;

    if (gate.state === 'break' && prev === 'ok') {
      // Capture exact position before the lock screen covers everything.
      const path = window.location.pathname + window.location.search;
      localStorage.setItem(RESUME_KEY, path);
    }

    if (gate.state === 'ok' && prev === 'break') {
      const path = localStorage.getItem(RESUME_KEY);
      if (path) {
        localStorage.removeItem(RESUME_KEY);
        router.replace(path);
      }
    }

    prevStateRef.current = gate.state;
  }, [gate?.state, router]);

  // 1-second ticker — drives all live countdowns.
  useEffect(() => {
    const locked = gate?.state === 'break' || gate?.state === 'cap';
    const warn = gate?.state === 'ok' && (gate?.blockSecondsLeft ?? 9999) <= 600;
    const hasCap = gate?.state === 'ok' && (gate?.dailyCapMinutes ?? 0) > 0;
    if (!locked && !warn && !hasCap) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      // Tick daily remaining down 1s — poll snaps it to server truth every 15s.
      if (hasCap) setDailyRemaining((r) => (r !== null ? Math.max(0, r - 1) : null));
    }, 1000);
    return () => clearInterval(id);
  }, [gate?.state, gate?.blockSecondsLeft, gate?.dailyCapMinutes]);

  if (!gate) return null;

  // ── Full-screen lock (break or cap) ───────────────────────────────
  if (gate.state === 'break' || gate.state === 'cap') {
    const isCap = gate.state === 'cap';
    const remainMs = breakEndRef.current ? breakEndRef.current - Date.now() : 0;
    void tick;
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
        style={{ background: 'rgba(15,12,45,0.97)' }}
        role="alertdialog"
        aria-modal="true"
        aria-label={isCap ? 'Kunlik vaqt tugadi' : 'Tanaffus'}
      >
        <div className="text-center max-w-sm w-full space-y-5">
          <div className="text-6xl" aria-hidden>{isCap ? '✅' : '☕'}</div>
          <h1 className="text-white text-2xl font-extrabold">
            {isCap ? "Bugungi o'quv vaqti tugadi" : 'Tanaffus vaqti'}
          </h1>
          <p className="text-white/70 text-sm leading-relaxed">
            {isCap
              ? `Bugun ${Math.round((gate.dailyCapMinutes / 60) * 10) / 10} soat o'qidingiz. Ertaga davom etamiz — dam oling!`
              : "Har soatdan keyin majburiy tanaffus. Ko'zingizni dam oldiring, biroz yuring."}
          </p>
          {!isCap && remainMs > 0 && (
            <div
              className="mx-auto inline-flex items-center justify-center rounded-2xl px-6 py-4 font-mono font-extrabold text-3xl text-white"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              {mmss(remainMs / 1000)}
            </div>
          )}
          <p className="text-white/40 text-xs">
            {isCap
              ? 'Sahifa avtomatik yangilanadi'
              : 'Tanaffus tugagach ilova avtomatik ochiladi'}
          </p>
        </div>
      </div>
    );
  }

  // ── State ok: live computations ───────────────────────────────────
  void tick; // force re-render every second

  const blockLeft = blockEndRef.current
    ? (blockEndRef.current - Date.now()) / 1000
    : gate.blockSecondsLeft;
  const isNearBreak = blockLeft > 0 && blockLeft <= 600;

  return (
    <>
      {/* Daily remaining countdown — always visible for students with a cap */}
      {gate.dailyCapMinutes > 0 && dailyRemaining !== null && (
        <div
          className="fixed top-14 right-3 z-[9997] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-md select-none"
          style={{ background: '#0f0c2d', color: '#fff' }}
          role="timer"
          aria-label={`Bugungi vaqt qoldi: ${hhmmss(dailyRemaining)}`}
          aria-live="off"
        >
          <span aria-hidden>⏱</span>
          <span className="font-mono tracking-tight">{hhmmss(dailyRemaining)}</span>
        </div>
      )}

      {/* Last-10-minutes break warning */}
      {isNearBreak && (
        <div
          className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[9998] inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-lg"
          style={{ background: '#0f0c2d', color: '#fff' }}
          role="status"
        >
          <span className="text-sm font-bold">
            ⏳ Tanaffusgacha: {mmss(blockLeft)}
          </span>
        </div>
      )}
    </>
  );
}
