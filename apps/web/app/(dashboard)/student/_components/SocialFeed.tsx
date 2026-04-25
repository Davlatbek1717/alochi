'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type FeedItem = {
  id: string;
  actorId: string;
  actorName: string;
  eventType: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

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
      const streak = typeof item.meta.streak === 'number' ? item.meta.streak : '?';
      return `${item.actorName} ${streak} kunlik streak! 🔥`;
    }
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
                <p className="text-xs text-gray-400 mt-0.5">{relativeTime(item.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
