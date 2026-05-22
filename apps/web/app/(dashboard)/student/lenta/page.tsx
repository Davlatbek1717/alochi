'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SocialFeed } from '../_components/SocialFeed';
import { apiRequest } from '@/lib/api';

interface Friend {
  id: string;
}

/**
 * Friends activity feed — redesigned chrome ("sp-theme") wrapping the
 * shared {@link SocialFeed} component (its real-time WebSocket feed and
 * event rendering are unchanged). The header surfaces friend count +
 * live/offline state so an empty feed reads as "no friends yet".
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
    <div className="sp-theme min-h-full pb-24">
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
          borderBottom: '1.5px solid var(--line)',
        }}
      >
        <div className="max-w-lg mx-auto md:max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link
            href="/student"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="sp-eyebrow">do‘stlar faolligi</div>
            <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
              Lenta
            </h1>
          </div>
          <span
            className="sp-mono text-[11px] px-2.5 py-1 shrink-0"
            style={{
              background: online ? 'var(--leaf-tint)' : 'var(--paper-2)',
              color: online ? 'var(--leaf-deep)' : 'var(--ink-4)',
              border: `1px solid ${online ? 'var(--leaf-soft)' : 'var(--line)'}`,
              borderRadius: 999,
            }}
            aria-live="polite"
          >
            {online ? '● Jonli' : 'Off-line'}
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-4 space-y-4">
        {friendCount !== null && (
          <div
            className="flex items-center gap-3 p-4"
            style={{
              background: friendCount === 0 ? 'var(--bone)' : 'var(--sky-soft)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--bone-2)', fontSize: 20 }}
            >
              👥
            </span>
            <div className="flex-1 min-w-0">
              <p className="sp-display text-sm" style={{ color: 'var(--ink)' }}>
                {friendCount === 0 ? 'Do‘stlar qo‘shing' : `${friendCount} ta do‘st`}
              </p>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--ink-3)' }}>
                {friendCount === 0
                  ? 'Lenta to‘lib turishi uchun do‘st kerak'
                  : 'Yangi yutuqlar real vaqtda ko‘rinadi'}
              </p>
            </div>
            <Link
              href="/student/friends"
              className="sp-display text-xs px-3 py-2 shrink-0"
              style={{
                background: 'var(--bone)',
                color: 'var(--sky)',
                border: '1px solid var(--sky-soft)',
                borderRadius: 'var(--r-2)',
                fontWeight: 700,
              }}
            >
              {friendCount === 0 ? "Qo‘shish" : 'Boshqarish'}
            </Link>
          </div>
        )}

        <SocialFeed />
      </div>
    </div>
  );
}
