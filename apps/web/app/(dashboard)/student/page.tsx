'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  BarChart2,
  Trophy,
  GraduationCap,
  Award,
  PlayCircle,
  Sparkles,
  BookOpen,
  Star,
  Newspaper,
  Mail,
  Users,
  Swords,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { XpBar } from './_components/XpBar';
import { StudentDailyQuests } from './_components/StudentDailyQuests';
import { SocialFeed } from './_components/SocialFeed';
import VirtualCity from './_components/VirtualCity';
import { DailyGoalRing } from './_components/DailyGoalRing';
import { StreakFlame } from './_components/StreakFlame';
import { LessonPathPreview } from './_components/LessonPathPreview';
import CertificateShare from '@/components/CertificateShare';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton, SkeletonCard } from '@/components/ui';
import { playSound } from '@/lib/sound';

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
  todayXp?: number;
  dailyGoal?: number;
};

type StreakData = {
  streak: number;
  hasShield: boolean;
};

type CityBuilding = {
  id: string;
  type: string;
  tier: number;
  index: number;
  unlockedAt: string;
  isNewest: boolean;
};

type CityData = {
  buildings: CityBuilding[];
  tier: { level: number; name: string };
  lessonsCompleted: number;
  nextTierAt: number | null;
  level?: number;
  name?: string;
  nextLevelAt?: number | null;
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

type Profile = {
  id: string;
  name: string;
  login: string;
};

type LessonInfo = {
  id: string;
  title?: string;
  orderNumber?: number;
  estimatedMinutes?: number;
  xpReward?: number;
  nRepetitions?: number;
};

type ProgressRow = { lessonId: string; sessionCount: number };

type LeagueData = { tier?: string; rank?: number };

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xpData, setXpData] = useState<XpData>({
    totalXp: 0,
    level: 'Novice',
    nextLevelXp: 5000,
    todayXp: 0,
    dailyGoal: 30,
  });
  const [quests, setQuests] = useState<Quest[]>([]);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [nextLesson, setNextLesson] = useState<LessonInfo | null>(null);
  const [nextLessonSession, setNextLessonSession] = useState<{ count: number; total: number } | null>(null);
  const [league, setLeague] = useState<LeagueData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let cancelled = false;

    async function fetchData(initial = false) {
      try {
        // The dashboard fans out 11 parallel requests on load — every one
        // is wrapped in .catch so a transient gamification 5xx never
        // blanks the page. The lessons/next call is the one that drives
        // the hero CTA, so a failure there falls back to a generic
        // "keyingi dars sizni kutmoqda" copy.
        const [
          profileRes,
          xpRes,
          questsRes,
          cityRes,
          streakRes,
          progressRes,
          warningsRes,
          reviewRes,
          certsRes,
          nextLessonRes,
          leagueRes,
        ] = await Promise.all([
          apiRequest<Profile>('/users/my-profile', {}, token).catch(() => ({ data: null as Profile | null })),
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<Quest[]>('/gamification/quests', {}, token),
          apiRequest<CityData>('/gamification/city', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<ProgressRow[]>('/progress/my', {}, token),
          apiRequest<Warning[]>('/warnings/my', {}, token).catch(() => ({ data: [] as Warning[] })),
          apiRequest<ReviewItem[]>('/ai/spaced-repetition/daily-review', {}, token).catch(() => ({ data: [] as ReviewItem[] })),
          apiRequest<Certificate[]>('/gamification/certificates', {}, token).catch(() => ({ data: [] as Certificate[] })),
          apiRequest<LessonInfo | null>('/lessons/next', {}, token).catch(() => ({ data: null as LessonInfo | null })),
          apiRequest<LeagueData>('/gamification/league/my', {}, token).catch(() => ({ data: null as LeagueData | null })),
        ]);
        if (cancelled) return;
        if (profileRes.data) setProfile(profileRes.data);
        setXpData(xpRes.data);
        setQuests(questsRes.data);
        setCityData(cityRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setLessonProgress(progressRes.data.length);
        setWarnings(warningsRes.data ?? []);
        setReviewItems(reviewRes.data ?? []);
        setCertificates(certsRes.data ?? []);

        const nextL = nextLessonRes.data ?? null;
        setNextLesson(nextL);
        if (nextL) {
          const row = (progressRes.data ?? []).find((p) => p.lessonId === nextL.id);
          if (nextL.nRepetitions && nextL.nRepetitions > 0) {
            setNextLessonSession({ count: row?.sessionCount ?? 0, total: nextL.nRepetitions });
          } else {
            setNextLessonSession(null);
          }
        } else {
          setNextLessonSession(null);
        }
        if (leagueRes.data) setLeague(leagueRes.data);
      } catch {
        // keep defaults on error
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    }

    fetchData(true);

    // Refetch when the tab regains focus or visibility flips back to visible.
    function onFocus() {
      fetchData(false);
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') fetchData(false);
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const todayXp = xpData.todayXp ?? 0;
  const dailyGoal = Math.max(1, xpData.dailyGoal ?? 30);

  const firstName = useMemo(() => {
    const n = (profile?.name ?? '').trim();
    if (!n) return '';
    return n.split(/\s+/)[0];
  }, [profile?.name]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4 pb-28 pt-4 px-4 bg-[#fffaf0] min-h-screen">
        <Skeleton theme="light" className="h-32 w-full rounded-3xl" />
        <Skeleton theme="light" className="h-44 w-full rounded-3xl" />
        <Skeleton theme="light" className="h-28 w-full rounded-3xl" />
        <SkeletonCard theme="light" />
      </div>
    );
  }

  const activeWarnings = warnings.filter((w) => !w.isCancelled);

  return (
    <div className="bg-[#fffaf0] min-h-screen">
      <div className="max-w-lg mx-auto pb-28 pt-4 px-4 space-y-5">
        {/* 1. Compact greeting hero — combines mascot + greeting + key stats
            in a single card so the user gets identity + status at a glance
            without scrolling through 3 separate widgets like before. */}
        <GreetingHero
          firstName={firstName}
          streak={streak}
          hasShield={hasShield}
          todayXp={todayXp}
          xpData={xpData}
          league={league}
        />

        {/* 2. Active warnings — only when present, never a perma-banner. */}
        {activeWarnings.length > 0 && (
          <WarningBanner warnings={activeWarnings} />
        )}

        {/* 3. Primary CTA — promoted to second-from-top so opening the
            app means seeing "Davom etish" within thumb's reach, not
            below 3 status widgets. */}
        <ContinueLessonCard
          nextLesson={nextLesson}
          session={nextLessonSession}
          lessonNumber={lessonProgress + 1}
        />

        {/* 4. Daily-goal ring with mini stats — secondary status, decoupled
            from the greeting so the ring's animation reads on its own. */}
        <DailyGoalCard
          todayXp={todayXp}
          dailyGoal={dailyGoal}
          totalXp={xpData.totalXp}
          level={xpData.level}
          nextLevelXp={xpData.nextLevelXp}
        />

        {/* 5. Daily quests — gamification hook, only when present. */}
        {quests.length > 0 && <StudentDailyQuests quests={quests} />}

        {/* 6. Daily review — spaced-repetition list, only when items exist. */}
        {reviewItems.length > 0 && (
          <DailyReviewCard items={reviewItems} />
        )}

        {/* 7. Lesson path peek. */}
        <LessonPathPreview />

        {/* 8. Virtual city — long-term motivation. */}
        {cityData && (
          <VirtualCity
            buildings={cityData.buildings ?? []}
            tier={cityData.tier ?? { level: cityData.level ?? 1, name: cityData.name ?? 'Qishloq' }}
            lessonsCompleted={cityData.lessonsCompleted ?? 0}
            nextTierAt={cityData.nextTierAt ?? cityData.nextLevelAt ?? null}
          />
        )}

        {/* 9. Certificates — surface only when earned, max 2 inline. */}
        {certificates.length > 0 && (
          <CertificatesCard
            certificates={certificates}
          />
        )}

        {/* 10. Browse more — destinations not in the bottom nav. Replaces
            the loose "Quick Actions" tiles + dead PathMap500 widget. */}
        <BrowseMoreGrid />

        {/* 11. Friends activity — kept compact, last few items. */}
        <SocialFeed />
      </div>
    </div>
  );
}

/* ============================================================================
   Subcomponents — kept in this file so the dashboard reads top-to-bottom.
   ============================================================================ */

function GreetingHero({
  firstName,
  streak,
  hasShield,
  todayXp,
  xpData,
  league,
}: {
  firstName: string;
  streak: number;
  hasShield: boolean;
  todayXp: number;
  xpData: XpData;
  league: LeagueData | null;
}) {
  const greeting = firstName ? `Salom, ${firstName}!` : 'Salom, do‘stim!';
  const subtitle = pickGreetingSubtitle(streak, todayXp);
  const mood = streak >= 3 || todayXp > 0 ? 'happy' : 'idle';

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[#f3e8c7] shadow-sm motion-safe:animate-[bounce-in_500ms_ease-out]"
      style={{
        background:
          'linear-gradient(135deg, #fffaf0 0%, #fef3c7 60%, #fde68a 100%)',
      }}
    >
      {/* Sun ray accent */}
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 p-5 space-y-4">
        {/* Top row: mascot + greeting + bell */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <Mascot expression={mood} size={88} animated />
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="text-2xl font-extrabold leading-tight text-[#3c3c3c] truncate"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {greeting}
            </h1>
            <p className="mt-1 text-sm font-bold text-[#7a5e2c] leading-snug">
              {subtitle}
            </p>
          </div>
          <Link
            href="/student/profile"
            aria-label="Bildirishnomalar"
            className="shrink-0 w-9 h-9 rounded-full bg-white/70 backdrop-blur border border-[#f3e8c7] flex items-center justify-center text-[#7a5e2c] hover:bg-white transition-colors"
          >
            <Bell size={16} />
          </Link>
        </div>

        {/* Bottom row: streak | today XP | league — single horizontal strip
            replaces what used to be a separate full-width white card */}
        <div className="grid grid-cols-3 gap-2">
          <HeroStat
            icon={<StreakFlame streak={streak} hasShield={hasShield} size={18} showLabel={false} />}
            value={streak.toString()}
            label="Kun zanjir"
          />
          <HeroStat
            icon={<Sparkles size={16} className="text-[#46a302]" />}
            value={todayXp.toString()}
            label="Bugun XP"
            highlight={todayXp > 0}
          />
          <HeroStat
            icon={<LeagueGlyph tier={league?.tier} />}
            value={leagueLabel(league?.tier)}
            label="Liga"
          />
        </div>

        {/* XP / level progress bar */}
        <XpBar
          totalXp={xpData.totalXp}
          level={xpData.level}
          nextLevelXp={xpData.nextLevelXp}
        />
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  value,
  label,
  highlight,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white/70 backdrop-blur rounded-2xl border border-[#f3e8c7] px-3 py-2.5 flex flex-col items-center gap-1">
      <div className="h-5 flex items-center justify-center">{icon}</div>
      <p
        className={`text-base font-extrabold leading-none ${
          highlight ? 'text-[#46a302]' : 'text-[#3c3c3c]'
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#7a5e2c]">
        {label}
      </p>
    </div>
  );
}

function ContinueLessonCard({
  nextLesson,
  session,
  lessonNumber,
}: {
  nextLesson: LessonInfo | null;
  session: { count: number; total: number } | null;
  lessonNumber: number;
}) {
  const title = nextLesson?.title ?? 'Keyingi dars sizni kutmoqda';
  const minutes = nextLesson?.estimatedMinutes ?? 5;
  const xp = nextLesson?.xpReward ?? 10;
  const showSession = session && session.total > 1;

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-sm motion-safe:animate-[bounce-in_500ms_ease-out]">
      <div className="bg-gradient-to-br from-[#58cc02] via-[#4cb702] to-[#3a8a02] p-5 text-white relative">
        {/* Soft white glow top-right */}
        <div
          aria-hidden
          className="absolute -top-10 -right-8 w-44 h-44 rounded-full opacity-30 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)',
          }}
        />
        {/* Bottom decorative chevrons */}
        <div
          aria-hidden
          className="absolute -bottom-6 right-3 text-white/15 pointer-events-none"
        >
          <ChevronRight size={120} strokeWidth={1.5} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle size={18} className="text-white/95" />
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/90">
              Davom etamiz
            </p>
            {showSession && (
              <span className="ml-auto bg-white/25 backdrop-blur text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Sessiya {session.count}/{session.total}
              </span>
            )}
          </div>
          <p className="text-2xl font-extrabold leading-tight">{title}</p>
          <div className="mt-2.5 flex items-center gap-3 text-[11px] font-bold text-white/90 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <BookOpen size={12} /> Dars {lessonNumber}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles size={12} /> ~{minutes} daqiqa
            </span>
            <span className="inline-flex items-center gap-1">
              <Star size={12} /> +{xp} XP
            </span>
          </div>
          <Link
            href="/student/lessons/current"
            onClick={() => playSound('xp', 0.5)}
            className="mt-4 block bg-white text-[#46a302] py-3 rounded-2xl font-extrabold text-base text-center border-b-[4px] border-[#cfe9b0] active:translate-y-[2px] active:border-b-[2px] transition-all hover:brightness-105"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Davom etish
          </Link>
        </div>
      </div>
    </div>
  );
}

function DailyGoalCard({
  todayXp,
  dailyGoal,
  totalXp,
  level,
  nextLevelXp,
}: {
  todayXp: number;
  dailyGoal: number;
  totalXp: number;
  level: string;
  nextLevelXp: number;
}) {
  const goalHit = todayXp >= dailyGoal;
  const xpToLevel = Math.max(0, nextLevelXp - totalXp);

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
      <div className="flex items-center gap-5">
        <div className="shrink-0">
          <DailyGoalRing
            todayXp={todayXp}
            goal={dailyGoal}
            size={120}
          />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#7a5e2c]">
            Kunlik maqsad
          </p>
          <p className="text-2xl font-extrabold text-[#3c3c3c] leading-tight">
            {todayXp} / {dailyGoal} XP
          </p>
          <p className="text-xs font-semibold text-[#777] leading-snug">
            {goalHit
              ? 'Bugungi maqsadingiz bajarildi! Davom eting va zanjirni saqlang.'
              : `Maqsadgacha yana ${dailyGoal - todayXp} XP qoldi`}
          </p>
          <div className="pt-1 flex items-center gap-2 text-[11px] font-bold">
            <span className="bg-[#f3eedf] text-[#46a302] border border-[#e8e0d0] px-2 py-0.5 rounded-full">
              Daraja: {level}
            </span>
            {xpToLevel > 0 && (
              <span className="text-[#777]">
                +{xpToLevel} XP keyingi darajaga
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WarningBanner({ warnings }: { warnings: Warning[] }) {
  const isBlocked = warnings.length >= 3;
  return (
    <div
      className={`rounded-2xl p-4 flex items-start gap-3 border ${
        isBlocked
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <span className="text-2xl shrink-0" aria-hidden>
        {isBlocked ? '\u{1F6A8}' : '\u{26A0}\u{FE0F}'}
      </span>
      <div className="flex-1">
        <p
          className={`font-extrabold text-sm ${
            isBlocked ? 'text-red-700' : 'text-amber-700'
          }`}
        >
          {isBlocked
            ? 'Hisobingiz bloklangan'
            : `${warnings.length} ta ogohlantirish`}
        </p>
        <p className="text-xs text-[#5b5b5b] mt-0.5 leading-snug">
          {warnings[0].reasonText}
          {warnings.length > 1 && ` va yana ${warnings.length - 1} ta`}
        </p>
      </div>
    </div>
  );
}

function DailyReviewCard({ items }: { items: ReviewItem[] }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1] space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw size={18} className="text-[#46a302]" />
        <h2 className="font-extrabold text-[#3c3c3c]">Kunlik takrorlash</h2>
        <span className="ml-auto text-xs font-bold text-[#777]">
          {items.length} ta so&apos;z
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 8).map((item) => (
          <span
            key={item.word}
            className="bg-[#f3eedf] text-[#46a302] text-sm px-3 py-1 rounded-full border border-[#e8e0d0] font-bold"
          >
            {item.word}
          </span>
        ))}
        {items.length > 8 && (
          <span className="bg-[#f3eedf] text-[#777] text-sm px-3 py-1 rounded-full border border-[#e8e0d0] font-semibold">
            +{items.length - 8}
          </span>
        )}
      </div>
      <Link
        href="/student/review"
        className="block text-center text-sm bg-[#58cc02] hover:brightness-105 text-white py-3 rounded-2xl font-extrabold uppercase tracking-wide border-b-[3px] border-[#46a302] active:translate-y-[2px] active:border-b-[1px] transition-all"
      >
        Takrorlashni boshlash
      </Link>
    </div>
  );
}

function CertificatesCard({ certificates }: { certificates: Certificate[] }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
      <div className="flex items-center gap-2 mb-3">
        <Award size={18} className="text-amber-500" />
        <h2 className="font-extrabold text-[#3c3c3c] text-base">Sertifikatlar</h2>
        <span className="ml-auto text-xs text-[#777] font-bold">
          {certificates.length} ta
        </span>
      </div>
      <div className="space-y-2.5">
        {certificates.slice(0, 2).map((cert) => (
          <div
            key={cert.id}
            className="border border-amber-200 bg-amber-50/60 rounded-2xl p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold text-amber-700 text-sm capitalize">
                {cert.level} sertifikati
              </p>
              <span className="text-xs text-[#777] font-semibold">
                {cert.lessonsCompleted} dars
              </span>
            </div>
            <CertificateShare cert={cert} />
          </div>
        ))}
      </div>
      {certificates.length > 2 && (
        <Link
          href="/student/certificates"
          className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-[#46a302] hover:underline"
        >
          Barchasini ko‘rish ({certificates.length})
          <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

/**
 * Tile grid for destinations not in the bottom nav. Replaces the loose
 * 2x2 "Quick Actions" card and the dead PathMap500 mini-widget; one
 * coherent navigation hub instead of two competing surfaces.
 */
function BrowseMoreGrid() {
  const items: { href: string; icon: React.ReactNode; title: string; sub: string; tint: string }[] = [
    {
      href: '/student/lenta',
      icon: <Newspaper size={20} />,
      title: 'Lenta',
      sub: 'Do‘stlar yangiliklari',
      tint: 'text-[#1cb0f6] bg-[#e0f2fe] border-[#bae6fd]',
    },
    {
      href: '/student/duels',
      icon: <Swords size={20} />,
      title: 'Duellar',
      sub: 'Tanlovlar',
      tint: 'text-[#ce82ff] bg-[#f5edff] border-[#e7d8ff]',
    },
    {
      href: '/student/tournaments',
      icon: <Trophy size={20} />,
      title: 'Turnirlar',
      sub: 'Musobaqalar',
      tint: 'text-[#fbbf24] bg-[#fef3c7] border-[#fde68a]',
    },
    {
      href: '/student/letters',
      icon: <Mail size={20} />,
      title: 'Harflar',
      sub: 'Kolleksiya',
      tint: 'text-[#10b981] bg-[#d1fae5] border-[#a7f3d0]',
    },
    {
      href: '/student/errors',
      icon: <BarChart2 size={20} />,
      title: 'Xato tahlili',
      sub: 'AI tavsiyalar',
      tint: 'text-[#ef4444] bg-[#fee2e2] border-[#fecaca]',
    },
    {
      href: '/student/friends',
      icon: <Users size={20} />,
      title: 'Do‘stlar',
      sub: 'Aloqalar',
      tint: 'text-[#46a302] bg-[#dcfce7] border-[#bbf7d0]',
    },
    {
      href: '/student/leaderboard',
      icon: <Trophy size={20} />,
      title: 'Reyting',
      sub: 'Liga',
      tint: 'text-[#fbbf24] bg-[#fef3c7] border-[#fde68a]',
    },
    {
      href: '/student/exams',
      icon: <GraduationCap size={20} />,
      title: 'Imtihonlar',
      sub: 'Sinov',
      tint: 'text-[#7c3aed] bg-[#ede9fe] border-[#ddd6fe]',
    },
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-[#7a5e2c] px-1">
        Yana
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#ede9e1] flex items-center gap-3 hover:border-[#58cc02]/40 hover:shadow-md transition-all"
          >
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${it.tint}`}
            >
              {it.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-sm text-[#3c3c3c] truncate">
                {it.title}
              </p>
              <p className="text-[11px] text-[#777] font-semibold truncate">
                {it.sub}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LeagueGlyph({ tier }: { tier?: string }) {
  const t = tier?.toLowerCase() ?? 'bronza';
  const color =
    t === 'almos' || t === 'diamond'
      ? 'text-[#7c3aed]'
      : t === 'platina' || t === 'platinum'
        ? 'text-[#0e7490]'
        : t === 'oltin' || t === 'gold'
          ? 'text-[#d97706]'
          : t === 'kumush' || t === 'silver'
            ? 'text-[#64748b]'
            : 'text-[#a16207]';
  return <Trophy size={16} className={color} />;
}

function leagueLabel(tier?: string): string {
  const map: Record<string, string> = {
    bronza: 'Bronza',
    bronze: 'Bronza',
    kumush: 'Kumush',
    silver: 'Kumush',
    oltin: 'Oltin',
    gold: 'Oltin',
    platina: 'Platina',
    platinum: 'Platina',
    almos: 'Olmos',
    diamond: 'Olmos',
  };
  return map[tier?.toLowerCase() ?? ''] ?? 'Bronza';
}

function pickGreetingSubtitle(streak: number, todayXp: number): string {
  if (todayXp > 0 && streak >= 7) {
    return `${streak} kun ketma-ket! Bugun yaxshi boshlandi`;
  }
  if (streak >= 30) return `${streak} kunlik afsonaviy zanjir 👑`;
  if (streak >= 14) return `${streak} kunlik olov 🔥 — davom etamiz`;
  if (streak >= 7) return `${streak} kunlik zanjir 🔥`;
  if (streak >= 3) return `${streak} kun ketma-ket — zo‘r ish!`;
  if (streak === 1 || streak === 2)
    return `Zanjirni saqlab qolaylik — bugun ${streak}-kun`;
  return 'Bugun yangi qadam tashlaymiz';
}
