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
  Flag,
  Brain,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import { SocialFeed } from './_components/SocialFeed';
import { StreakFlame } from './_components/StreakFlame';
import { LessonPathPreview } from './_components/LessonPathPreview';
import CertificateShare from '@/components/CertificateShare';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton, SkeletonCard } from '@/components/ui';

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

type StatusColor = 'yashil' | 'sariq' | 'qizil' | '';
type StatusData = {
  englishStatus?: StatusColor;
  personalStatus?: StatusColor;
  criticalStatus?: StatusColor;
};

const STATUS_VISUAL: Record<
  string,
  { label: string; bg: string; text: string; ring: string; tone: string }
> = {
  yashil: {
    label: 'Yaxshi',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    tone: 'bg-emerald-500',
  },
  sariq: {
    label: 'Diqqat',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    tone: 'bg-amber-500',
  },
  qizil: {
    label: "E'tibor",
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
    tone: 'bg-rose-500',
  },
  '': {
    label: '—',
    bg: 'bg-[#f3eedf]',
    text: 'text-[#777]',
    ring: 'ring-[#e8e0d0]',
    tone: 'bg-[#cbbf9c]',
  },
};

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xpData, setXpData] = useState<XpData>({
    totalXp: 0,
    level: 'Novice',
    nextLevelXp: 5000,
  });
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [nextLesson, setNextLesson] = useState<LessonInfo | null>(null);
  const [nextLessonSession, setNextLessonSession] = useState<{ count: number; total: number } | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let cancelled = false;

    async function fetchData(initial = false) {
      try {
        const [
          profileRes,
          xpRes,
          streakRes,
          progressRes,
          warningsRes,
          reviewRes,
          certsRes,
          nextLessonRes,
          statusRes,
        ] = await Promise.all([
          apiRequest<Profile>('/users/my-profile', {}, token).catch(() => ({ data: null as Profile | null })),
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<ProgressRow[]>('/progress/my', {}, token),
          apiRequest<Warning[]>('/warnings/my', {}, token).catch(() => ({ data: [] as Warning[] })),
          apiRequest<ReviewItem[]>('/ai/spaced-repetition/daily-review', {}, token).catch(() => ({ data: [] as ReviewItem[] })),
          apiRequest<Certificate[]>('/gamification/certificates', {}, token).catch(() => ({ data: [] as Certificate[] })),
          apiRequest<LessonInfo | null>('/lessons/next', {}, token).catch(() => ({ data: null as LessonInfo | null })),
          apiRequest<StatusData>('/status/my', {}, token).catch(() => ({ data: null as StatusData | null })),
        ]);
        if (cancelled) return;
        if (profileRes.data) setProfile(profileRes.data);
        setXpData(xpRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setLessonProgress(progressRes.data.length);
        setWarnings(warningsRes.data ?? []);
        setReviewItems(reviewRes.data ?? []);
        setCertificates(certsRes.data ?? []);
        setStatusData(statusRes.data);

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
      } catch {
        // keep defaults on error
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    }

    fetchData(true);

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
        {/* 1. Compact greeting hero — mascot + name + streak/step */}
        <GreetingHero
          firstName={firstName}
          streak={streak}
          hasShield={hasShield}
          currentStep={lessonProgress + 1}
          level={xpData.level}
        />

        {/* 2. Active warnings — only when present, never a perma-banner. */}
        {activeWarnings.length > 0 && (
          <WarningBanner warnings={activeWarnings} />
        )}

        {/* 3. Primary CTA — promoted to second-from-top so opening the
            app means seeing "Davom etish" within thumb's reach. */}
        <ContinueLessonCard
          nextLesson={nextLesson}
          session={nextLessonSession}
          lessonNumber={lessonProgress + 1}
        />

        {/* 4. Three-discipline status block — the mentor-managed colour
            indicator for English / Personal Development / Critical Thinking. */}
        <StatusBlock data={statusData} />

        {/* 5. Daily review — spaced-repetition list, only when items exist. */}
        {reviewItems.length > 0 && <DailyReviewCard items={reviewItems} />}

        {/* 6. Lesson path peek. */}
        <LessonPathPreview />

        {/* 7. Certificates — surface only when earned, max 2 inline. */}
        {certificates.length > 0 && (
          <CertificatesCard certificates={certificates} />
        )}

        {/* 8. Browse more — destinations not in the bottom nav. */}
        <BrowseMoreGrid />

        {/* 9. Friends activity. */}
        <SocialFeed />
      </div>
    </div>
  );
}

/* ============================================================================
   Subcomponents
   ============================================================================ */

function GreetingHero({
  firstName,
  streak,
  hasShield,
  currentStep,
  level,
}: {
  firstName: string;
  streak: number;
  hasShield: boolean;
  currentStep: number;
  level: string;
}) {
  const greeting = firstName ? `Salom, ${firstName}!` : 'Salom, do‘stim!';
  const subtitle = pickGreetingSubtitle(streak, currentStep);
  const mood = streak >= 3 ? 'happy' : 'idle';

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[#f3e8c7] shadow-sm motion-safe:animate-[bounce-in_500ms_ease-out]"
      style={{
        background:
          'linear-gradient(135deg, #fffaf0 0%, #fef3c7 60%, #fde68a 100%)',
      }}
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 p-5 space-y-4">
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

        {/* Stat strip — Streak | Qadam | Daraja */}
        <div className="grid grid-cols-3 gap-2">
          <HeroStat
            icon={
              <StreakFlame
                streak={streak}
                hasShield={hasShield}
                size={18}
                showLabel={false}
              />
            }
            value={streak.toString()}
            label="Kun zanjir"
          />
          <HeroStat
            icon={<Flag size={16} className="text-[#46a302]" />}
            value={`#${currentStep}`}
            label="Qadam"
            highlight
          />
          <HeroStat
            icon={<Star size={16} className="text-[#fbbf24]" />}
            value={level}
            label="Daraja"
          />
        </div>
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
        className={`text-base font-extrabold leading-none truncate max-w-full ${
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
        <div
          aria-hidden
          className="absolute -top-10 -right-8 w-44 h-44 rounded-full opacity-30 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)',
          }}
        />
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

function StatusBlock({ data }: { data: StatusData | null }) {
  // Per-discipline mentor-managed status colour. The whole block is
  // shown even before the first lesson finishes (with "—" placeholders)
  // so the student knows where the slots will surface their grades.
  const items: { field: keyof StatusData; label: string; icon: React.ReactNode }[] = [
    { field: 'englishStatus', label: 'Ingliz tili', icon: <BookOpen size={16} /> },
    { field: 'personalStatus', label: 'Shaxsiy', icon: <Brain size={16} /> },
    { field: 'criticalStatus', label: 'Tanqidiy', icon: <Lightbulb size={16} /> },
  ];
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1] space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[#7a5e2c]">
          Sizning holatingiz
        </p>
        <span
          className="text-[#94a3b8]"
          title="Mentor har bir sohada belgilaydigan rang: yashil — yaxshi, sariq — diqqat, qizil — e'tibor"
        >
          <HelpCircle size={12} />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const val: string = data?.[it.field] ?? '';
          const v = STATUS_VISUAL[val] ?? STATUS_VISUAL[''];
          return (
            <div
              key={it.field}
              className={`rounded-2xl p-3 ring-1 ${v.bg} ${v.ring} flex flex-col items-center gap-1 text-center`}
            >
              <div className={`relative ${v.text}`}>{it.icon}</div>
              <p className={`text-sm font-extrabold ${v.text}`}>{v.label}</p>
              <p className="text-[10px] text-[#777] font-bold uppercase tracking-wider">
                {it.label}
              </p>
              <span
                aria-hidden
                className={`mt-0.5 w-2 h-2 rounded-full ${v.tone}`}
              />
            </div>
          );
        })}
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

function pickGreetingSubtitle(streak: number, currentStep: number): string {
  if (streak >= 30) return `${streak} kunlik afsonaviy zanjir 👑`;
  if (streak >= 14) return `${streak} kunlik olov 🔥 — davom etamiz`;
  if (streak >= 7) return `${streak} kunlik zanjir 🔥`;
  if (streak >= 3) return `${streak} kun ketma-ket — zo‘r ish!`;
  if (currentStep === 1) return 'Birinchi qadamingizni tashlang!';
  return `${currentStep}-qadamga keldingiz — davom etamiz`;
}
