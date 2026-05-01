'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RefreshCw, BarChart2, Trophy, GraduationCap, Award, FlaskConical, ClipboardList, AlertTriangle } from 'lucide-react';
import { XpBar } from '../student/_components/XpBar';
import { StreakBadge } from '../student/_components/StreakBadge';
import { DailyQuests } from '../student/_components/DailyQuests';
import { SocialFeed } from '../student/_components/SocialFeed';
import VirtualCity from '../student/_components/VirtualCity';
import PathMap500 from '@/components/PathMap500';
import CertificateShare from '@/components/CertificateShare';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, SkeletonCard } from '@/components/ui';

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
  nextLevelAt: number | null;
  name?: string;
};

type StatusData = {
  englishStatus?: string;
  personalStatus?: string;
  criticalStatus?: string;
};

type ReviewItem = { word: string; easeFactor: number; interval: number };

type Warning = {
  id: string;
  reasonType: string;
  reasonText: string;
  isCancelled: boolean;
  createdAt: string;
};

type Certificate = {
  id: string;
  level: string;
  lessonsCompleted: number;
  qrCode?: string;
  issuedAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  yashil: '🟢',
  sariq: '🟡',
  qizil: '🔴',
  '': '⚪',
};

export default function TesterDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [quests, setQuests] = useState<Quest[]>([]);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, questsRes, cityRes, streakRes, progressRes, statusRes, warningsRes, reviewRes, certsRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<Quest[]>('/gamification/quests', {}, token),
          apiRequest<CityData>('/gamification/city', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<unknown[]>('/progress/my', {}, token).catch(() => ({ data: [] as unknown[] })),
          apiRequest<StatusData>('/status/my', {}, token).catch(() => ({ data: null as StatusData | null })),
          apiRequest<Warning[]>('/warnings/my', {}, token).catch(() => ({ data: [] as Warning[] })),
          apiRequest<ReviewItem[]>('/ai/spaced-repetition/daily-review', {}, token).catch(() => ({ data: [] as ReviewItem[] })),
          apiRequest<Certificate[]>('/gamification/certificates', {}, token).catch(() => ({ data: [] as Certificate[] })),
        ]);
        setXpData(xpRes.data);
        setQuests(questsRes.data);
        setCityData(cityRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setLessonProgress(progressRes.data?.length ?? 0);
        setStatusData(statusRes.data);
        setWarnings(warningsRes.data ?? []);
        setReviewItems(reviewRes.data ?? []);
        setCertificates(certsRes.data ?? []);
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
      <div className="max-w-lg mx-auto space-y-4 pb-20 pt-4 px-4">
        <Skeleton theme="light" className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton theme="light" className="h-16 rounded-xl" />
          <Skeleton theme="light" className="h-16 rounded-xl" />
          <Skeleton theme="light" className="h-16 rounded-xl" />
        </div>
        <SkeletonCard theme="light" />
        <SkeletonCard theme="light" />
      </div>
    );
  }

  const activeWarnings = warnings.filter((w) => !w.isCancelled);

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-20">
      <div className="bg-[#0f172a] rounded-2xl p-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-[#94a3b8] text-sm">🧪 Tester paneli</p>
            <p className="text-2xl font-bold mt-1">Dars #{lessonProgress}</p>
          </div>
          <StreakBadge streak={streak} hasShield={hasShield} />
        </div>
        <div className="mt-3 relative z-10">
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

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Yo&apos;l xaritasi
        </p>
        <PathMap500 currentStep={lessonProgress} />
        <p className="text-xs text-gray-500 mt-2 text-right">
          {lessonProgress} / 500 dars
        </p>
      </div>

      {certificates.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-amber-500" />
            <h2 className="font-bold text-gray-800 text-sm">Sertifikatlar</h2>
            <span className="text-xs text-gray-500">{certificates.length} ta</span>
          </div>
          <div className="space-y-3">
            {certificates.slice(0, 3).map((cert) => (
              <div
                key={cert.id}
                className="border border-amber-100 bg-amber-50/40 rounded-xl p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-amber-700 text-sm capitalize">
                    {cert.level} sertifikati
                  </p>
                  <span className="text-xs text-gray-500">
                    {cert.lessonsCompleted} dars
                  </span>
                </div>
                <CertificateShare cert={cert} />
              </div>
            ))}
          </div>
        </div>
      )}

      {cityData && (
        <VirtualCity
          level={cityData?.level ?? 1}
          buildings={cityData?.buildings ?? []}
          lessonsCompleted={cityData?.lessonsCompleted ?? 0}
          nextLevelAt={cityData?.nextLevelAt ?? null}
          name={cityData?.name}
        />
      )}

      {reviewItems.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-[#0d9488]" />
            <h2 className="font-bold text-gray-800">Kunlik Takrorlash</h2>
          </div>
          <p className="text-sm text-gray-500">{reviewItems.length} ta so&apos;z takrorlanishi kerak</p>
          <div className="flex flex-wrap gap-2">
            {reviewItems.slice(0, 6).map((item) => (
              <span
                key={item.word}
                className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-full border border-indigo-100"
              >
                {item.word}
              </span>
            ))}
            {reviewItems.length > 6 && (
              <span className="bg-gray-50 text-gray-500 text-sm px-3 py-1 rounded-full border border-gray-100">
                +{reviewItems.length - 6} ta
              </span>
            )}
          </div>
          <Link
            href="/student/review"
            className="block text-center text-sm bg-[#0f172a] hover:bg-[#1e293b] text-white py-2.5 rounded-xl font-semibold transition-colors"
          >
            Takrorlashni boshlash →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/student/review"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2"
        >
          <RefreshCw size={22} className="text-[#0d9488]" />
          <p className="font-bold text-sm text-gray-800">Takrorlash</p>
          <p className="text-xs text-gray-500">Spaced repetition</p>
        </Link>
        <Link
          href="/student/errors"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2"
        >
          <BarChart2 size={22} className="text-[#7c3aed]" />
          <p className="font-bold text-sm text-gray-800">Xato tahlili</p>
          <p className="text-xs text-gray-500">AI tavsiyalar</p>
        </Link>
        <Link
          href="/student/tournaments"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2"
        >
          <Trophy size={22} className="text-[#f59e0b]" />
          <p className="font-bold text-sm text-gray-800">Turnirlar</p>
          <p className="text-xs text-gray-500">Musobaqalar</p>
        </Link>
        <Link
          href="/student/exams"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2"
        >
          <GraduationCap size={22} className="text-[#7c3aed]" />
          <p className="font-bold text-sm text-gray-800">Imtihonlar</p>
          <p className="text-xs text-gray-500">Imtihon topshirish</p>
        </Link>
      </div>

      <Link
        href="/tester/exam-queue"
        className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:scale-[1.02] transition-transform"
      >
        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <FlaskConical size={22} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-gray-800">🧪 Sinov navbati</p>
          <p className="text-xs text-gray-500">Imtihon topshirayotgan o&apos;quvchilar</p>
        </div>
        <span className="text-gray-300 text-xl">›</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/tester/tasks"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2 hover:scale-[1.02] transition-transform"
        >
          <ClipboardList size={22} className="text-[#0d9488]" />
          <p className="font-bold text-sm text-gray-800">Vazifalar</p>
          <p className="text-xs text-gray-500">Tester topshiriqlari</p>
        </Link>
        <Link
          href="/tester/tech-issues"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2 hover:scale-[1.02] transition-transform"
        >
          <AlertTriangle size={22} className="text-rose-500" />
          <p className="font-bold text-sm text-gray-800">Texnik muammo</p>
          <p className="text-xs text-gray-500">Bug-report yuborish</p>
        </Link>
      </div>

      <SocialFeed />

      {/* 25.H.1: tiny chip that shows current lesson session/N */}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-0 right-0 px-4 max-w-lg mx-auto space-y-2">
        <CurrentLessonChip />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="!rounded-2xl !py-4 !bg-[#f59e0b] hover:!bg-[#d97706] !border-[#f59e0b] shadow-lg"
          onClick={() => { window.location.href = '/tester/lessons/current'; }}
        >
          ▶️ Sinov darsi
        </Button>
      </div>
    </div>
  );
}

/**
 * 25.H.1: "Sessiya {sessionCount}/{N}" chip rendered just above the
 * "Sinov darsi" CTA. Reads from /lessons/next + /progress/my.
 */
function CurrentLessonChip() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    if (!token) return;
    type LessonInfo = { id: string; nRepetitions: number };
    type ProgressRow = { lessonId: string; sessionCount: number };
    Promise.all([
      apiRequest<LessonInfo | null>('/lessons/next', {}, token).catch(() => null),
      apiRequest<ProgressRow[]>('/progress/my', {}, token).catch(() => null),
    ]).then(([lesson, progress]) => {
      const data = lesson?.data ?? null;
      if (!data) return;
      const row = progress?.data?.find((p) => p.lessonId === data.id);
      const count = row?.sessionCount ?? 0;
      setText(`Sessiya ${count}/${data.nRepetitions}`);
    });
  }, []);

  if (!text) return null;
  return (
    <div className="bg-white border-[1.5px] border-[#ede9e1] rounded-full px-3 py-1 text-xs font-semibold text-[#0f172a] inline-block shadow-sm">
      {text}
    </div>
  );
}
