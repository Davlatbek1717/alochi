'use client';
import Link from 'next/link';
import { XpBar } from './_components/XpBar';
import { StreakBadge } from './_components/StreakBadge';
import { DailyQuests } from './_components/DailyQuests';
import { SocialFeed } from './_components/SocialFeed';

const DEMO_DATA = {
  totalXp: 2340,
  level: 'Scholar',
  nextLevelXp: 5000,
  streak: 12,
  hasShield: true,
  cityName: 'Shaharcha',
  lessonProgress: 47,
  statuses: {
    english: 'green',
    personal: 'yellow',
    critical: 'green',
  },
  quests: [
    { questType: 'learn_words', targetValue: 3, progress: 3, completed: true, xpReward: 75 },
    { questType: 'watch_video', targetValue: 1, progress: 1, completed: true, xpReward: 50 },
    { questType: 'ask_tutor', targetValue: 3, progress: 0, completed: false, xpReward: 100 },
  ],
};

const STATUS_EMOJI: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴' };

export default function StudentDashboard() {
  const d = DEMO_DATA;

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-20">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/70 text-sm">🏙️ {d.cityName}</p>
            <p className="text-2xl font-bold mt-1">Dars #{d.lessonProgress} / 500</p>
          </div>
          <StreakBadge streak={d.streak} hasShield={d.hasShield} />
        </div>
        <div className="mt-3">
          <XpBar totalXp={d.totalXp} level={d.level} nextLevelXp={d.nextLevelXp} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ingliz tili', key: 'english' },
          { label: 'Shaxsiy', key: 'personal' },
          { label: "Tanqidiy", key: 'critical' },
        ].map((s) => {
          const status = d.statuses[s.key as keyof typeof d.statuses];
          return (
            <div key={s.key} className="bg-white rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl">{STATUS_EMOJI[status] ?? '⚪'}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      <DailyQuests quests={d.quests} />

      <SocialFeed />

      <div className="fixed bottom-20 left-0 right-0 px-4 max-w-lg mx-auto">
        <Link
          href="/student/lessons/current"
          className="block w-full bg-indigo-600 text-white py-4 rounded-2xl text-center font-bold shadow-lg"
        >
          ▶️ Bugungi Darsni Boshlash
        </Link>
      </div>
    </div>
  );
}
