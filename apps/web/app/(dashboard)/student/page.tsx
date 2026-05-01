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
} from 'lucide-react';
import { XpBar } from './_components/XpBar';
import { StudentDailyQuests } from './_components/StudentDailyQuests';
import { SocialFeed } from './_components/SocialFeed';
import VirtualCity from './_components/VirtualCity';
import { MascotGreeting } from './_components/MascotGreeting';
import { DailyGoalRing } from './_components/DailyGoalRing';
import { StreakFlame } from './_components/StreakFlame';
import { LessonPathPreview } from './_components/LessonPathPreview';
import PathMap500 from '@/components/PathMap500';
import CertificateShare from '@/components/CertificateShare';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, SkeletonCard, type MascotExpression } from '@/components/ui';
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

const STATUS_LABELS: Record<string, { label: string; bg: string; ring: string; text: string }> = {
  yashil: { label: 'Yaxshi', bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  sariq: { label: 'Diqqat', bg: 'bg-amber-50', ring: 'ring-amber-200', text: 'text-amber-700' },
  qizil: { label: "E'tibor", bg: 'bg-red-50', ring: 'ring-red-200', text: 'text-red-700' },
  '': { label: '—', bg: 'bg-[#f3eedf]', ring: 'ring-[#e8e0d0]', text: 'text-[#777]' },
};

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
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [nextLesson, setNextLesson] = useState<LessonInfo | null>(null);
  const [nextLessonSession, setNextLessonSession] = useState<{ count: number; total: number } | null>(null);
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [mascotMood, setMascotMood] = useState<MascotExpression>('idle');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [
          profileRes,
          xpRes,
          questsRes,
          cityRes,
          streakRes,
          progressRes,
          statusRes,
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
          apiRequest<StatusData>('/status/my', {}, token).catch(() => ({ data: null as StatusData | null })),
          apiRequest<Warning[]>('/warnings/my', {}, token).catch(() => ({ data: [] as Warning[] })),
          apiRequest<ReviewItem[]>('/ai/spaced-repetition/daily-review', {}, token).catch(() => ({ data: [] as ReviewItem[] })),
          apiRequest<Certificate[]>('/gamification/certificates', {}, token).catch(() => ({ data: [] as Certificate[] })),
          apiRequest<LessonInfo | null>('/lessons/next', {}, token).catch(() => ({ data: null as LessonInfo | null })),
          apiRequest<LeagueData>('/gamification/league/my', {}, token).catch(() => ({ data: null as LeagueData | null })),
        ]);
        if (profileRes.data) setProfile(profileRes.data);
        setXpData(xpRes.data);
        setQuests(questsRes.data);
        setCityData(cityRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setLessonProgress(progressRes.data.length);
        setStatusData(statusRes.data);
        setWarnings(warningsRes.data ?? []);
        setReviewItems(reviewRes.data ?? []);
        setCertificates(certsRes.data ?? []);

        const nextL = nextLessonRes.data ?? null;
        setNextLesson(nextL);
        if (nextL) {
          const row = (progressRes.data ?? []).find((p) => p.lessonId === nextL.id);
          if (nextL.nRepetitions && nextL.nRepetitions > 0) {
            setNextLessonSession({ count: row?.sessionCount ?? 0, total: nextL.nRepetitions });
          }
        }
        if (leagueRes.data) setLeague(leagueRes.data);
      } catch {
        // keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const todayXp = xpData.todayXp ?? 0;
  const dailyGoal = Math.max(1, xpData.dailyGoal ?? 30);

  // First name extraction — split on first space, fall back to full name.
  const firstName = useMemo(() => {
    const n = (profile?.name ?? '').trim();
    if (!n) return '';
    return n.split(/\s+/)[0];
  }, [profile?.name]);

  const handleGoalHit = () => {
    setMascotMood('happy');
    window.setTimeout(() => setMascotMood('idle'), 3000);
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4 pb-28 pt-4 px-4 bg-[#fffaf0] min-h-screen">
        <Skeleton theme="light" className="h-32 w-full rounded-3xl" />
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1] flex items-center gap-4">
          <Skeleton theme="light" className="h-32 w-32 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton theme="light" className="h-4 w-24 rounded" />
            <Skeleton theme="light" className="h-8 w-32 rounded" />
            <Skeleton theme="light" className="h-3 w-20 rounded" />
          </div>
        </div>
        <SkeletonCard theme="light" />
        <SkeletonCard theme="light" />
      </div>
    );
  }

  const activeWarnings = warnings.filter((w) => !w.isCancelled);

  return (
    <div className="bg-[#fffaf0] min-h-screen">
      <div className="max-w-lg mx-auto space-y-5 pb-28 pt-4 px-4">
        {/* 1. Mascot greeting hero */}
        <MascotGreeting firstName={firstName} streak={streak} expression={mascotMood} />

        {/* 2. Daily goal ring + Streak/League */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1] flex items-center gap-5">
          <div className="shrink-0">
            <DailyGoalRing
              todayXp={todayXp}
              goal={dailyGoal}
              size={130}
              onGoalHit={handleGoalHit}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <StreakFlame streak={streak} hasShield={hasShield} size={36} />
              <LeagueBadge league={league} />
            </div>
            <XpBar
              totalXp={xpData.totalXp}
              level={xpData.level}
              nextLevelXp={xpData.nextLevelXp}
            />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#777]">
              Bugun: <span className="text-[#46a302] font-extrabold">{todayXp} XP</span>
            </p>
          </div>
        </div>

        {/* 3. Warning banner (only if active) */}
        {activeWarnings.length > 0 && (
          <div
            className={`rounded-2xl p-4 flex items-start gap-3 border ${
              activeWarnings.length >= 3
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <span className="text-2xl shrink-0" aria-hidden>
              {activeWarnings.length >= 3 ? '\u{1F6A8}' : '\u{26A0}\u{FE0F}'}
            </span>
            <div className="flex-1">
              <p
                className={`font-extrabold text-sm ${
                  activeWarnings.length >= 3 ? 'text-red-700' : 'text-amber-700'
                }`}
              >
                {activeWarnings.length >= 3
                  ? 'Hisobingiz bloklangan'
                  : `${activeWarnings.length} ta ogohlantirish`}
              </p>
              <p className="text-xs text-[#5b5b5b] mt-0.5 leading-snug">
                {activeWarnings[0].reasonText}
                {activeWarnings.length > 1 && ` va yana ${activeWarnings.length - 1} ta`}
              </p>
            </div>
          </div>
        )}

        {/* 4. Davom etish CTA card */}
        <ContinueLessonCard
          nextLesson={nextLesson}
          session={nextLessonSession}
          lessonNumber={lessonProgress + 1}
        />

        {/* 5. Daily quests as chests */}
        {quests.length > 0 && <StudentDailyQuests quests={quests} />}

        {/* 6. Lesson path preview */}
        <LessonPathPreview />

        {/* 7. Stats strip */}
        <StatsStrip
          totalXp={xpData.totalXp}
          level={xpData.level}
          streak={streak}
          lessonsCompleted={lessonProgress}
          certificates={certificates.length}
        />

        {/* 8. Status pills (mood / behaviour) */}
        {statusData && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#777] mb-3">
              Sizning holatingiz
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Ingliz tili', field: 'englishStatus' as const },
                { label: 'Shaxsiy', field: 'personalStatus' as const },
                { label: 'Tanqidiy', field: 'criticalStatus' as const },
              ].map((s) => {
                const status = statusData?.[s.field] ?? '';
                const cfg = STATUS_LABELS[status] ?? STATUS_LABELS[''];
                return (
                  <div
                    key={s.field}
                    className={`rounded-2xl p-3 text-center ring-1 ${cfg.bg} ${cfg.ring}`}
                  >
                    <p className={`text-sm font-extrabold ${cfg.text}`}>{cfg.label}</p>
                    <p className="text-[10px] text-[#777] mt-1 font-semibold">{s.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 9. Path map preview */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#777]">
              Yo&apos;l xaritasi
            </p>
            <span className="text-xs font-bold text-[#46a302]">
              {lessonProgress} / 500 dars
            </span>
          </div>
          <PathMap500 currentStep={lessonProgress} />
        </div>

        {/* 10. Certificates */}
        {certificates.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
            <div className="flex items-center gap-2 mb-3">
              <Award size={18} className="text-amber-500" />
              <h2 className="font-extrabold text-[#3c3c3c] text-base">Sertifikatlar</h2>
              <span className="text-xs text-[#777] font-semibold">
                {certificates.length} ta
              </span>
            </div>
            <div className="space-y-3">
              {certificates.slice(0, 3).map((cert) => (
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
          </div>
        )}

        {/* 11. Virtual city */}
        {cityData && (
          <VirtualCity
            level={cityData?.level ?? 1}
            buildings={cityData?.buildings ?? []}
            lessonsCompleted={cityData?.lessonsCompleted ?? 0}
            nextLevelAt={cityData?.nextLevelAt ?? null}
            name={cityData?.name}
          />
        )}

        {/* 12. Daily review (spaced repetition) */}
        {reviewItems.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1] space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw size={18} className="text-[#46a302]" />
              <h2 className="font-extrabold text-[#3c3c3c]">Kunlik Takrorlash</h2>
            </div>
            <p className="text-sm text-[#777] font-semibold">
              {reviewItems.length} ta so&apos;z takrorlanishi kerak
            </p>
            <div className="flex flex-wrap gap-2">
              {reviewItems.slice(0, 6).map((item) => (
                <span
                  key={item.word}
                  className="bg-[#f3eedf] text-[#46a302] text-sm px-3 py-1 rounded-full border border-[#e8e0d0] font-bold"
                >
                  {item.word}
                </span>
              ))}
              {reviewItems.length > 6 && (
                <span className="bg-[#f3eedf] text-[#777] text-sm px-3 py-1 rounded-full border border-[#e8e0d0] font-semibold">
                  +{reviewItems.length - 6} ta
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
        )}

        {/* 13. Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            href="/student/review"
            icon={<RefreshCw size={22} className="text-[#46a302]" />}
            title="Takrorlash"
            sub="Spaced repetition"
          />
          <QuickAction
            href="/student/errors"
            icon={<BarChart2 size={22} className="text-[#ce82ff]" />}
            title="Xato tahlili"
            sub="AI tavsiyalar"
          />
          <QuickAction
            href="/student/tournaments"
            icon={<Trophy size={22} className="text-[#fbbf24]" />}
            title="Turnirlar"
            sub="Musobaqalar"
          />
          <QuickAction
            href="/student/exams"
            icon={<GraduationCap size={22} className="text-[#ce82ff]" />}
            title="Imtihonlar"
            sub="Imtihon topshirish"
          />
        </div>

        {/* 14. Friends activity */}
        <SocialFeed />
      </div>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

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
    <div className="bg-gradient-to-br from-[#58cc02] via-[#4cb702] to-[#3a8a02] rounded-3xl p-5 shadow-sm text-white relative overflow-hidden motion-safe:animate-[bounce-in_500ms_ease-out]">
      <div
        aria-hidden
        className="absolute -top-10 -right-8 w-40 h-40 rounded-full opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <PlayCircle size={18} className="text-white/90" />
          <p className="text-xs font-extrabold uppercase tracking-wider text-white/90">
            Keyingi dars
          </p>
          {showSession && (
            <span className="ml-auto bg-white/25 backdrop-blur text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              Sessiya {session.count}/{session.total}
            </span>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-extrabold leading-tight">{title}</p>
        <div className="mt-2 flex items-center gap-3 text-xs font-bold text-white/90">
          <span className="inline-flex items-center gap-1">
            <BookOpen size={14} /> Dars {lessonNumber}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles size={14} /> ~{minutes} daqiqa
          </span>
          <span className="inline-flex items-center gap-1">
            <Star size={14} /> +{xp} XP
          </span>
        </div>
        <Button
          variant="duo"
          size="lg"
          fullWidth
          className="mt-4 !bg-white !text-[#46a302] !border-b-[#cfe9b0] hover:!bg-white hover:brightness-105"
          onClick={() => {
            playSound('xp', 0.5);
            window.location.href = '/student/lessons/current';
          }}
        >
          Davom etish
        </Button>
      </div>
    </div>
  );
}

function StatsStrip({
  totalXp,
  level,
  streak,
  lessonsCompleted,
  certificates,
}: {
  totalXp: number;
  level: string;
  streak: number;
  lessonsCompleted: number;
  certificates: number;
}) {
  const tiles: { icon: string; value: string | number; label: string; color: string }[] = [
    { icon: '⚡', value: totalXp.toLocaleString(), label: 'Total XP', color: 'text-[#ce82ff]' },
    { icon: '\u{1F3C5}', value: level, label: 'Daraja', color: 'text-[#46a302]' },
    { icon: '\u{1F525}', value: streak, label: 'Streak', color: 'text-[#ff9500]' },
    { icon: '\u{1F4DA}', value: lessonsCompleted, label: 'Darslar', color: 'text-[#58a6ff]' },
    { icon: '\u{1F396}\u{FE0F}', value: certificates, label: 'Sertifikat', color: 'text-amber-600' },
  ];

  return (
    <div className="-mx-4 px-4 overflow-x-auto scrollbar-thin">
      <div className="flex gap-3 min-w-max">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="bg-white rounded-2xl p-3 shadow-sm border border-[#ede9e1] min-w-[88px] text-center"
          >
            <p className="text-xl leading-none">{t.icon}</p>
            <p className={`text-lg font-extrabold mt-1 ${t.color} leading-tight truncate`}>
              {t.value}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#777] mt-0.5">
              {t.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl p-4 shadow-sm border border-[#ede9e1] flex flex-col gap-2 hover:border-[#58cc02] hover:shadow-md transition-all"
    >
      {icon}
      <p className="font-extrabold text-sm text-[#3c3c3c]">{title}</p>
      <p className="text-xs text-[#777] font-semibold">{sub}</p>
    </Link>
  );
}

function LeagueBadge({ league }: { league: LeagueData | null }) {
  const tier = league?.tier?.toLowerCase() ?? 'bronza';
  const map: Record<string, { color: string; label: string }> = {
    bronza: { color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Bronza' },
    bronze: { color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Bronza' },
    kumush: { color: 'bg-slate-100 text-slate-600 border-slate-300', label: 'Kumush' },
    silver: { color: 'bg-slate-100 text-slate-600 border-slate-300', label: 'Kumush' },
    oltin: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'Oltin' },
    gold: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'Oltin' },
    platina: { color: 'bg-cyan-100 text-cyan-700 border-cyan-300', label: 'Platina' },
    platinum: { color: 'bg-cyan-100 text-cyan-700 border-cyan-300', label: 'Platina' },
    almos: { color: 'bg-violet-100 text-violet-700 border-violet-300', label: 'Olmos' },
    diamond: { color: 'bg-violet-100 text-violet-700 border-violet-300', label: 'Olmos' },
  };
  const cfg = map[tier] ?? map.bronza;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border ${cfg.color}`}
    >
      <Trophy size={10} />
      {cfg.label}
    </span>
  );
}
