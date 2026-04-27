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

type StreakData = {
  streak: number;
  hasShield: boolean;
};

type CityData = {
  level: number;
  buildings: string[];
  lessonsCompleted: number;
  nextLevelAt: number;
  name?: string;
};

type StatusData = {
  englishStatus?: string;
  personalStatus?: string;
  criticalStatus?: string;
};

type Warning = {
  id: string;
  reasonType: string;
  reasonText: string;
  isCancelled: boolean;
  createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  yashil: '🟢',
  sariq: '🟡',
  qizil: '🔴',
  '': '⚪',
};

export default function StudentDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [quests, setQuests] = useState<Quest[]>([]);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, questsRes, cityRes, streakRes, progressRes, statusRes, warningsRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<Quest[]>('/gamification/quests', {}, token),
          apiRequest<CityData>('/gamification/city', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<unknown[]>('/progress/my', {}, token),
          apiRequest<StatusData>('/status/my', {}, token).catch(() => ({ data: null as StatusData | null })),
          apiRequest<Warning[]>('/warnings/my', {}, token).catch(() => ({ data: [] as Warning[] })),
        ]);
        setXpData(xpRes.data);
        setQuests(questsRes.data);
        setCityData(cityRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setLessonProgress(progressRes.data.length);
        setStatusData(statusRes.data);
        setWarnings(warningsRes.data ?? []);
      } catch {
        // keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex items-center justify-center py-20">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  const activeWarnings = warnings.filter((w) => !w.isCancelled);

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-20">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/70 text-sm">🏙️ Shaharcha</p>
            <p className="text-2xl font-bold mt-1">Dars #{lessonProgress} / 500</p>
          </div>
          <StreakBadge streak={streak} hasShield={hasShield} />
        </div>
        <div className="mt-3">
          <XpBar totalXp={xpData.totalXp} level={xpData.level} nextLevelXp={xpData.nextLevelXp} />
        </div>
      </div>

      {activeWarnings.length > 0 && (
        <div className={`rounded-xl p-3 flex items-start gap-3 ${activeWarnings.length >= 3 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <span className="text-xl shrink-0">{activeWarnings.length >= 3 ? '🔴' : '⚠️'}</span>
          <div className="flex-1">
            <p className={`font-semibold text-sm ${activeWarnings.length >= 3 ? 'text-red-700' : 'text-yellow-700'}`}>
              {activeWarnings.length >= 3 ? 'Hisobingiz bloklangan' : `${activeWarnings.length} ta ogohlantirish`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeWarnings[0].reasonText}
              {activeWarnings.length > 1 && ` va yana ${activeWarnings.length - 1} ta`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ingliz tili', field: 'englishStatus' as const },
          { label: 'Shaxsiy', field: 'personalStatus' as const },
          { label: 'Tanqidiy', field: 'criticalStatus' as const },
        ].map((s) => (
          <div key={s.field} className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl">
              {STATUS_COLOR[statusData?.[s.field] ?? ''] ?? '⚪'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <DailyQuests quests={quests} />

      {cityData && (
        <VirtualCity
          level={cityData?.level ?? 1}
          buildings={cityData?.buildings ?? []}
          lessonsCompleted={cityData?.lessonsCompleted ?? 0}
          nextLevelAt={cityData?.nextLevelAt ?? 50}
          name={cityData?.name}
        />
      )}

      <SocialFeed />

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-0 right-0 px-4 max-w-lg mx-auto">
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
