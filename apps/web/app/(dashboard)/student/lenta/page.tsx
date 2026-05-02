'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Newspaper,
  Users,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { SocialFeed } from '../_components/SocialFeed';
import { apiRequest } from '@/lib/api';

interface Friend {
  id: string;
}

/**
 * Friends activity feed page.
 *
 * Wraps the shared {@link SocialFeed} component with a richer header
 * that surfaces:
 *   - friends count (so an empty feed reads as "no friends yet" rather
 *     than an unexplained blank)
 *   - live-stream indicator (the feed subscribes to a WebSocket for new
 *     events; showing the connection state reassures the student that
 *     this is a real-time list and not a stale snapshot)
 */
export default function StudentLentaPage() {
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Friend[]>('/social/friends', {}, token)
      .then((res) => setFriendCount((res.data ?? []).length))
      .catch(() => setFriendCount(0));

    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    setOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-full bg-[#fffaf0] pb-28">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/95 backdrop-blur border-b-[1.5px] border-[#ede9e1]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/student"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-full bg-white border border-[#ede9e1] flex items-center justify-center text-[#3c3c3c] hover:bg-[#f3eedf] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#0f172a] text-lg font-extrabold leading-tight flex items-center gap-2">
              <Newspaper size={18} className="text-[#1cb0f6]" />
              Lenta
            </h1>
            <p className="text-[11px] text-[#64748b] font-semibold leading-snug">
              Do&apos;stlaringizning so&apos;nggi yutuqlari
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
              online
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-[#fffaf0] text-[#94a3b8] border-[#ede9e1]'
            }`}
            aria-live="polite"
          >
            {online ? (
              <>
                <Wifi size={10} /> Jonli
              </>
            ) : (
              <>
                <WifiOff size={10} /> Off-line
              </>
            )}
          </span>
        </div>
      </header>

      <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">
        {/* Friends summary card. Hidden until the count loads so the page
            doesn't flash a "0 do'st" state while the request is in-flight. */}
        {friendCount !== null && (
          <div
            className={`rounded-3xl p-4 flex items-center gap-3 border-[1.5px] ${
              friendCount === 0
                ? 'bg-white border-[#ede9e1]'
                : 'bg-gradient-to-br from-white to-[#dbeafe] border-[#bfdbfe]'
            }`}
          >
            <div className="w-11 h-11 rounded-2xl bg-[#1cb0f6]/15 flex items-center justify-center text-[#1cb0f6] shrink-0">
              <Users size={20} />
            </div>
            <div className="flex-1 min-w-0">
              {friendCount === 0 ? (
                <>
                  <p className="text-sm font-extrabold text-[#0f172a]">
                    Do&apos;stlar qo&apos;shing
                  </p>
                  <p className="text-xs text-[#64748b] font-semibold mt-0.5 leading-snug">
                    Lenta to&apos;lib turishi uchun do&apos;st kerak
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-extrabold text-[#0f172a]">
                    {friendCount} ta do&apos;st
                  </p>
                  <p className="text-xs text-[#64748b] font-semibold mt-0.5 leading-snug">
                    Yangi yutuqlar real vaqtda ko&apos;rinadi
                  </p>
                </>
              )}
            </div>
            <Link
              href="/student/friends"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1cb0f6] bg-white border border-[#bfdbfe] px-3 py-2 rounded-xl hover:bg-[#dbeafe] transition-colors shrink-0"
            >
              <Sparkles size={12} />
              {friendCount === 0 ? "Qo'shish" : "Boshqarish"}
            </Link>
          </div>
        )}

        <SocialFeed />
      </div>
    </div>
  );
}
