'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface FeedItem {
  userId: string;
  userName: string;
  lessonId: string;
  lessonTitle: string;
  sessionCount: number;
  homeCompleted: boolean;
  lastActivityAt: string;
}

function relativeTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} daqiqa oldin`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} soat oldin`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} kun oldin`;
}

export function SocialFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<FeedItem[]>('/social/feed', {}, token)
      .then((res) => { if (!cancelled) setFeed(res.data); })
      .catch(() => { if (!cancelled) setFeed([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
      <h3 className="font-semibold">👥 Do&apos;stlar Lentasi</h3>
      {loading ? (
        <p className="text-sm text-gray-400 py-2">Yuklanmoqda...</p>
      ) : feed.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">Do&apos;stlaringiz hali faol emas</p>
      ) : (
        feed.map((item) => (
          <div key={`${item.userId}:${item.lessonId}`} className="flex items-center gap-3 py-2 border-b last:border-0">
            <span className="text-xl">📚</span>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-medium">{item.userName}</span> —{' '}
                <span className="italic">{item.lessonTitle}</span> darsini tugatdi.{' '}
                <span className="text-gray-500">{item.sessionCount} marta o&apos;rganilgan</span>
              </p>
              <p className="text-xs text-gray-400">{relativeTime(item.lastActivityAt)}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
