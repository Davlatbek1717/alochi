'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { XpBar } from './_components/XpBar';
import { StreakBadge } from './_components/StreakBadge';
import { DailyQuests } from './_components/DailyQuests';
import { SocialFeed } from './_components/SocialFeed';
import VirtualCity from './_components/VirtualCity';
import { apiRequest } from '@/lib/api';

type Quest = {
  questType: string;
  targetValue: number;
  progress: number;
  completed: boolean;
  xpReward: number;
};

type XpData = {
  totalXp: number;
  level: string;
  nextLevelXp: number;
};

type CityData = {
  level: number;
  buildings: string[];
  lessonsCompleted: number;
  nextLevelAt: number;
};

const STATIC_DATA = {
  streak: 12,
  hasShield: true,
  cityName: 'Shaharcha',
  lessonProgress: 47,
  statuses: {
    english: 'green',
    personal: 'yellow',
    critical: 'green',
  },
};

const STATUS_EMOJI: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴' };

export default function StudentDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [quests, setQuests] = useState<Quest[]>([]);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, questsRes, cityRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<Quest[]>('/gamification/quests', {}, token),
          apiRequest<CityData>('/gamification/city', {}, token),
        ]);
        setXpData(xpRes.data);
        setQuests(questsRes.data);
        setCityData(cityRes.data);
      } catch {
        // keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const d = STATIC_DATA;

  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex items-center justify-center py-20">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

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
          <XpBar totalXp={xpData.totalXp} level={xpData.level} nextLevelXp={xpData.nextLevelXp} />
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

      <DailyQuests quests={quests} />

      {cityData && (
        <VirtualCity
          level={cityData.level}
          buildings={cityData.buildings}
          lessonsCompleted={cityData.lessonsCompleted}
          nextLevelAt={cityData.nextLevelAt}
        />
      )}

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
