'use client';
import { useEffect, useState } from 'react';

interface FeedEvent {
  type: 'lesson_complete' | 'badge' | 'duel_win' | 'streak';
  studentName: string;
  detail: string;
  xp?: number;
  timestamp: Date;
}

const EVENT_ICONS: Record<string, string> = {
  lesson_complete: '📚',
  badge: '🏅',
  duel_win: '⚔️',
  streak: '🔥',
};

const DEMO_FEED: FeedEvent[] = [
  { type: 'lesson_complete', studentName: 'Sardor', detail: "Dars #48 o'tdi!", xp: 100, timestamp: new Date() },
  { type: 'badge', studentName: 'Malika', detail: 'Gold sertifikat oldi!', timestamp: new Date() },
  { type: 'duel_win', studentName: 'Jasur', detail: "Duel g'olib!", xp: 50, timestamp: new Date() },
];

export function SocialFeed() {
  const [events, _setEvents] = useState<FeedEvent[]>(DEMO_FEED);

  useEffect(() => {
    // socket.io client integration goes here when wiring real-time
  }, []);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
      <h3 className="font-semibold">👥 Do&apos;stlar Lentasi</h3>
      {events.map((event, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
          <span className="text-xl">{EVENT_ICONS[event.type] ?? '📌'}</span>
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium">{event.studentName}</span> — {event.detail}
            </p>
          </div>
          {event.xp && (
            <span className="text-indigo-600 text-sm font-medium">+{event.xp} XP</span>
          )}
        </div>
      ))}
    </div>
  );
}
