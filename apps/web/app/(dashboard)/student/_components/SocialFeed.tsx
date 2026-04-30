'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { apiRequest } from '@/lib/api';

type FeedItem = {
  id: string;
  actorId: string;
  actorName: string;
  eventType: string;
  meta: Record<string, unknown>;
  createdAt: string;
  reactionCount?: number;
  myReaction?: string;
};

const FEED_EMOJIS = ['👍', '🎉', '💪', '🔥', '❤️'];

function relativeTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'Hozirgina';
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Hozirgina';
  if (diffMin < 60) return `${diffMin} daqiqa oldin`;
  if (diffHour < 24) return `${diffHour} soat oldin`;
  return `${diffDay} kun oldin`;
}

function eventLabel(item: FeedItem): string {
  switch (item.eventType) {
    case 'lesson_done': {
      const title = typeof item.meta.lessonTitle === 'string' ? item.meta.lessonTitle : '';
      return `${item.actorName} "${title}" darsini tugatdi! 📚`;
    }
    case 'duel_won':
      return `${item.actorName} duelda g'olib bo'ldi! ⚔️`;
    case 'streak_milestone': {
      const days =
        typeof item.meta.days === 'number'
          ? item.meta.days
          : typeof item.meta.streak === 'number'
            ? item.meta.streak
            : '?';
      return `${item.actorName} ${days} kunlik streak! 🔥`;
    }
    case 'streak_broken':
      return `${item.actorName} streakni yo'qotdi 💔`;
    case 'cert_earned': {
      const lvl = typeof item.meta.level === 'string' ? item.meta.level : '';
      return `${item.actorName} sertifikatga erishdi (${lvl}) 🏅`;
    }
    case 'city_upgraded': {
      const name = typeof item.meta.name === 'string' ? item.meta.name : '';
      return `${item.actorName} shahrini yangiladi: ${name} 🏙️`;
    }
    case 'challenge_won':
      return `${item.actorName}'s guruh challenge'da g'olib bo'ldi! 🏆`;
    default:
      return `${item.actorName} faol bo'ldi`;
  }
}

export function SocialFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('accessToken') ?? '';

    apiRequest<FeedItem[]>('/social/feed', {}, token)
      .then((res) => {
        if (!cancelled) setFeed(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setFeed([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    const socket = io(`${apiUrl}/social`, { auth: { token } });

    socket.on('feed:event', (event: { type: string; data: { actorId: string; actorName: string; meta: Record<string, unknown>; createdAt: string } }) => {
      setFeed((prev) => [
        {
          id: `live-${Date.now()}`,
          actorId: event.data.actorId,
          actorName: event.data.actorName,
          eventType: event.type,
          meta: event.data.meta,
          createdAt: event.data.createdAt,
        },
        ...prev.slice(0, 19),
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-400 text-center">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-700 mb-3 text-sm">Do&apos;stlar lentasi</h2>

      {feed.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Do&apos;stlaringiz hali faol emas
        </p>
      ) : (
        <ul className="space-y-3">
          {feed.map((item) => (
            <li key={`${item.actorId}:${item.id}`} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                {item.actorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug">{eventLabel(item)}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-gray-400">{relativeTime(item.createdAt)}</p>
                  <FeedReactionBar item={item} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedReactionBar({ item }: { item: FeedItem }) {
  const [count, setCount] = useState<number>(item.reactionCount ?? 0);
  const [chosen, setChosen] = useState<string | null>(item.myReaction ?? null);
  const [open, setOpen] = useState(false);

  async function react(emoji: string) {
    setOpen(false);
    if (item.id.startsWith('live-')) return;
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/social/feed/${item.id}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }, token);
      if (!chosen) setCount((c) => c + 1);
      setChosen(emoji);
    } catch {
      // swallow — reaction is best-effort
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="text-xs px-2 py-0.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500"
        onClick={() => setOpen((v) => !v)}
      >
        {chosen ?? '🙂'} {count > 0 ? count : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 flex gap-1 bg-white rounded-full px-2 py-1 shadow border border-gray-100">
          {FEED_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="text-base leading-none hover:scale-125 transition-transform"
              onClick={() => react(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
