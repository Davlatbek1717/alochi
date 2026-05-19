'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  BookOpen,
  Swords,
  Flame,
  HeartCrack,
  Award,
  Building2,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton } from '@/components/ui';

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

const FEED_EMOJIS = ['❤️', '👍', '🎉', '💪', '🔥'];

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
      return `"${title}" darsini tugatdi`;
    }
    case 'duel_won':
      return `duelda gʻolib boʻldi`;
    case 'streak_milestone': {
      const days =
        typeof item.meta.days === 'number'
          ? item.meta.days
          : typeof item.meta.streak === 'number'
            ? item.meta.streak
            : '?';
      return `${days} kunlik streak`;
    }
    case 'streak_broken':
      return `streakni yoʻqotdi`;
    case 'cert_earned': {
      const lvl = typeof item.meta.level === 'string' ? item.meta.level : '';
      return `sertifikatga erishdi (${lvl})`;
    }
    case 'city_upgraded': {
      const name = typeof item.meta.name === 'string' ? item.meta.name : '';
      return `shahrini yangiladi: ${name}`;
    }
    case 'challenge_won':
      return `guruh challenge'da gʻolib boʻldi`;
    default:
      return `faol boʻldi`;
  }
}

function eventIcon(eventType: string) {
  switch (eventType) {
    case 'lesson_done':
      return <BookOpen size={16} className="text-[#1cb0f6]" />;
    case 'duel_won':
      return <Swords size={16} className="text-[#ce82ff]" />;
    case 'streak_milestone':
      return <Flame size={16} className="text-[#ef4444]" />;
    case 'streak_broken':
      return <HeartCrack size={16} className="text-[#94a3b8]" />;
    case 'cert_earned':
      return <Award size={16} className="text-[#fbbf24]" />;
    case 'city_upgraded':
      return <Building2 size={16} className="text-[#10b981]" />;
    case 'challenge_won':
      return <Trophy size={16} className="text-[#f59e0b]" />;
    default:
      return <Sparkles size={16} className="text-[#94a3b8]" />;
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
    // Strip /api suffix so socket.io namespace resolves to /social, not /api/social
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/api$/, '');

    const socket = io(`${apiUrl}/social`, { auth: { token } });

    socket.on(
      'feed:event',
      (event: {
        type: string;
        data: {
          actorId: string;
          actorName: string;
          meta: Record<string, unknown>;
          createdAt: string;
        };
      }) => {
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
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} theme="light" className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-8 text-center">
        <Mascot expression="sleeping" size={120} className="mx-auto" />
        <p className="text-[#0f172a] font-bold mt-3">Hozircha hech narsa yoʻq</p>
        <p className="text-[#64748b] text-sm mt-1">
          Doʻstlaringiz faol boʻlganda lentada koʻrinadi.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {feed.map((item) => (
        <li
          key={`${item.actorId}:${item.id}`}
          className="bg-white rounded-[16px] border-[1.5px] border-[#ede9e1] p-3 motion-safe:[animation:count-up-fade_400ms_ease-out]"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#d97706] border-2 border-white flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow">
              {item.actorName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 leading-snug">
                <span className="font-extrabold text-[#0f172a] text-sm">
                  {item.actorName}
                </span>
                <span>{eventIcon(item.eventType)}</span>
              </div>
              <p className="text-sm text-[#0f172a] leading-snug">
                {eventLabel(item)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-bold">
                  {relativeTime(item.createdAt)}
                </p>
                <FeedReactionBar item={item} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
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
      await apiRequest(
        `/social/feed/${item.id}/react`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        },
        token,
      );
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
        className="text-xs px-2 py-0.5 rounded-full bg-[#fffaf0] border border-[#ede9e1] hover:bg-[#fef3c7] text-[#64748b] transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label="Reaktsiya qoʻshish"
      >
        {chosen ?? '❤️'}{' '}
        {count > 0 ? <span className="font-bold text-[#0f172a]">{count}</span> : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 flex gap-1 bg-white rounded-full px-2 py-1 shadow-lg border border-[#ede9e1]">
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
