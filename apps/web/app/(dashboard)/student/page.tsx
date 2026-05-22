'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Video } from 'lucide-react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { SocialFeed } from './_components/SocialFeed';
import { apiRequest } from '@/lib/api';
import { Ustoz, Suzani } from '@/components/Ustoz';

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

type VideoSlotStatus = 'submitted' | 'late' | 'missed' | 'pending' | null;
type VideoToday = {
  canUploadMorning: boolean;
  canUploadEvening: boolean;
  morningStatus: VideoSlotStatus;
  eveningStatus: VideoSlotStatus;
};

type LessonInfo = {
  id: string;
  title?: string;
  orderNumber?: number;
  estimatedMinutes?: number;
  nRepetitions?: number;
};

type ProgressRow = { lessonId: string; sessionCount: number };

type ExamProgress = {
  totalExams: number;
  passedCount: number;
  currentOrder: number;
  currentExamTitle: string | null;
  allDone: boolean;
};

type StatusColor = 'yashil' | 'sariq' | 'qizil' | '';
type StatusData = {
  englishStatus?: StatusColor;
  personalStatus?: StatusColor;
  criticalStatus?: StatusColor;
};

// Mentor-assigned discipline status → sp-theme semantic tone.
const STATUS_TONE: Record<
  string,
  { dot: string; note: string; noteColor: string }
> = {
  yashil: { dot: 'var(--ok)', note: 'yaxshi', noteColor: 'var(--leaf)' },
  sariq: { dot: 'var(--warn)', note: 'diqqat', noteColor: 'var(--gold-deep)' },
  qizil: { dot: 'var(--bad)', note: "e'tibor", noteColor: 'var(--ember)' },
  '': { dot: 'var(--ink-4)', note: '—', noteColor: 'var(--ink-3)' },
};

const CERT_TIER_UZ: Record<string, string> = {
  bronze: 'Bronza',
  silver: 'Kumush',
  gold: 'Oltin',
  diamond: 'Olmos',
};
const CERT_RANK = ['bronze', 'silver', 'gold', 'diamond'];

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
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
  const [examProgress, setExamProgress] = useState<ExamProgress | null>(null);
  const [videoToday, setVideoToday] = useState<VideoToday | null>(null);
  // Initial-load failure surface. Background refreshes (focus, visibility)
  // intentionally don't update this so a brief flake on a tab switch
  // doesn't tear down a working dashboard. Retry bumps reloadKey which
  // re-runs the effect.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const retryLoad = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const load = useCallback(async () => {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const [
        profileRes,
        streakRes,
        progressRes,
        warningsRes,
        reviewRes,
        certsRes,
        nextLessonRes,
        statusRes,
        examProgressRes,
        videoTodayRes,
      ] = await Promise.all([
        apiRequest<Profile>('/users/my-profile', {}, token).catch(() => ({ data: null as Profile | null })),
        apiRequest<StreakData>('/gamification/streak', {}, token),
        apiRequest<ProgressRow[]>('/progress/my', {}, token),
        apiRequest<Warning[]>('/warnings/my', {}, token).catch(() => ({ data: [] as Warning[] })),
        apiRequest<ReviewItem[]>('/ai/spaced-repetition/daily-review', {}, token).catch(() => ({ data: [] as ReviewItem[] })),
        apiRequest<Certificate[]>('/gamification/certificates', {}, token).catch(() => ({ data: [] as Certificate[] })),
        apiRequest<LessonInfo | null>('/lessons/next', {}, token).catch(() => ({ data: null as LessonInfo | null })),
        apiRequest<StatusData>('/status/my', {}, token).catch(() => ({ data: null as StatusData | null })),
        apiRequest<ExamProgress>('/exams/my-progress', {}, token).catch(() => ({ data: null as ExamProgress | null })),
        apiRequest<VideoToday>('/video-checkins/my-today', {}, token).catch(() => ({ data: null as VideoToday | null })),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      setStreak(streakRes.data.streak);
      setHasShield(streakRes.data.hasShield);
      setLessonProgress(progressRes.data.length);
      setWarnings(warningsRes.data ?? []);
      setReviewItems(reviewRes.data ?? []);
      setCertificates(certsRes.data ?? []);
      setStatusData(statusRes.data);
      setExamProgress(examProgressRes.data);
      setVideoToday(videoTodayRes.data);

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
      // Successful refresh clears any stale error from a previous attempt.
      setLoadError(null);
    } catch (err) {
      // Background refreshes (focus/visibility) intentionally don't surface
      // errors so a brief flake on a tab switch doesn't tear down a working
      // dashboard. Errors on the initial load (still in loading state) are
      // surfaced so the user gets the retry button.
      if (loading) {
        setLoadError(
          err instanceof Error ? err.message : 'Maʼlumotlar yuklanmadi',
        );
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh whenever the user switches back to this tab or returns from
  // another window. Canonical implementation lives in useFocusRevalidate —
  // all pages use the same hook instead of duplicating listener wiring.
  useFocusRevalidate(load);

  // Real-time: revalidate on socket push so certs and status changes
  // appear without the student having to switch tabs.
  useRevalidateOnEvent(['cert:earned', 'status:updated'], load);

  const firstName = useMemo(() => {
    const n = (profile?.name ?? '').trim();
    if (!n) return '';
    return n.split(/\s+/)[0];
  }, [profile?.name]);

  const bestCert = useMemo(() => {
    let best = -1;
    for (const c of certificates) {
      const r = CERT_RANK.indexOf(c.level);
      if (r > best) best = r;
    }
    return best >= 0 ? CERT_TIER_UZ[CERT_RANK[best]] : null;
  }, [certificates]);

  if (loading) {
    return (
      <div className="sp-theme min-h-full px-4 pt-4 pb-24 max-w-lg mx-auto md:max-w-3xl space-y-4">
        <div className="sp-skeleton h-12 w-2/3" />
        <div className="sp-skeleton h-40 w-full" style={{ borderRadius: 'var(--r-4)' }} />
        <div className="grid grid-cols-3 gap-2">
          <div className="sp-skeleton h-20" />
          <div className="sp-skeleton h-20" />
          <div className="sp-skeleton h-20" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="sp-skeleton h-24" />
          <div className="sp-skeleton h-24" />
          <div className="sp-skeleton h-24" />
          <div className="sp-skeleton h-24" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="sp-theme sp-paper-dots min-h-full flex items-center justify-center p-6">
        <div
          className="text-center max-w-sm w-full space-y-4 p-8"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-4)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <Ustoz size={120} mood="oops" className="mx-auto" />
          <p className="sp-display text-lg" style={{ color: 'var(--ink)' }}>
            Internet bilan muammo
          </p>
          <p
            className="sp-mono text-xs"
            style={{ color: 'var(--ink-3)' }}
          >
            {loadError}
          </p>
          <button
            type="button"
            onClick={retryLoad}
            className="sp-display inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
            style={{
              background: 'var(--leaf)',
              color: 'var(--bone)',
              border: '2px solid var(--leaf-deep)',
              borderRadius: 'var(--r-3)',
              boxShadow: '0 4px 0 var(--leaf-deep)',
              fontWeight: 700,
            }}
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  const activeWarnings = warnings.filter((w) => !w.isCancelled);
  const currentStep = lessonProgress + 1;
  const tracks = [
    { code: 'EN', label: 'Ingliz tili', value: statusData?.englishStatus ?? '' },
    { code: 'PR', label: 'Rivojlanish', value: statusData?.personalStatus ?? '' },
    { code: 'CR', label: 'Tanqidiy fikr', value: statusData?.criticalStatus ?? '' },
  ];

  return (
    <div className="sp-theme min-h-full pb-24">
      <div className="max-w-lg mx-auto md:max-w-3xl">
        {/* ── Greeting header ── */}
        <header className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center sp-display shrink-0"
            style={{
              background: 'var(--gold-tint)',
              border: '2px solid var(--gold-deep)',
              color: 'var(--gold-deep)',
              fontWeight: 800,
            }}
          >
            {(firstName || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="sp-eyebrow">Salom,</div>
            <div className="sp-display text-xl truncate" style={{ color: 'var(--ink)' }}>
              {firstName || 'do‘stim'}!
            </div>
          </div>
          <Link
            href="/student/lenta"
            aria-label="Bildirishnomalar"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
          >
            <Bell size={18} />
            {(activeWarnings.length > 0 || reviewItems.length > 0) && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: 'var(--ember)' }}
              />
            )}
          </Link>
        </header>

        {/* ── Active warnings ── */}
        {activeWarnings.length > 0 && (
          <div className="px-4 mb-3">
            <div
              className="p-4 flex items-start gap-3"
              style={{
                background: activeWarnings.length >= 3 ? 'var(--ember-tint)' : 'var(--gold-tint)',
                border: `1.5px solid ${activeWarnings.length >= 3 ? 'var(--ember-soft)' : 'var(--gold-soft)'}`,
                borderRadius: 'var(--r-3)',
              }}
            >
              <span className="text-xl shrink-0" aria-hidden>
                {activeWarnings.length >= 3 ? '🚨' : '⚠️'}
              </span>
              <div className="min-w-0">
                <p
                  className="sp-display text-sm"
                  style={{ color: activeWarnings.length >= 3 ? 'var(--ember-deep)' : 'var(--gold-deep)' }}
                >
                  {activeWarnings.length >= 3
                    ? 'Hisobingiz bloklangan'
                    : `${activeWarnings.length} ta ogohlantirish`}
                </p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--ink-2)' }}>
                  {activeWarnings[0].reasonText}
                  {activeWarnings.length > 1 && ` va yana ${activeWarnings.length - 1} ta`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Daily video — prominent standout card ── */}
        <div className="px-4 mb-3">
          <DailyVideoCard status={videoToday} />
        </div>

        {/* ── Hero CTA ── */}
        <div className="px-4">
          <div
            className="relative overflow-hidden"
            style={{
              background: 'var(--leaf)',
              color: 'var(--bone)',
              borderRadius: 'var(--r-4)',
              boxShadow: '0 6px 0 var(--leaf-deep)',
            }}
          >
            <div className="absolute -top-3 -right-3 opacity-[0.18] pointer-events-none" aria-hidden>
              <Suzani size={140} color="var(--bone)" />
            </div>
            <div className="relative p-5 flex gap-4">
              <div className="flex-1 min-w-0">
                <div className="sp-eyebrow" style={{ color: 'var(--gold-soft)' }}>
                  Joriy dars · qadam {currentStep}
                </div>
                {examProgress && examProgress.totalExams > 0 && (
                  <div
                    className="sp-eyebrow mt-0.5"
                    style={{ color: 'var(--gold-soft)', opacity: 0.85 }}
                  >
                    {examProgress.allDone
                      ? `Imtihonlar · barchasi oʻtildi (${examProgress.totalExams}/${examProgress.totalExams})`
                      : `Joriy imtihon · #${examProgress.currentOrder} / ${examProgress.totalExams}`}
                  </div>
                )}
                <h2 className="sp-display text-xl leading-tight mt-1.5 mb-1">
                  {nextLesson?.title ?? 'Barcha darslar tugatildi 🎉'}
                </h2>
                <div className="text-[13px] opacity-85 mb-3.5">
                  {nextLesson
                    ? `~${nextLesson.estimatedMinutes ?? 5} daqiqa${
                        nextLessonSession && nextLessonSession.total > 1
                          ? ` · sessiya ${nextLessonSession.count}/${nextLessonSession.total}`
                          : ''
                      }`
                    : 'Zo‘r ish — davom eting'}
                </div>
                <Link
                  href={nextLesson ? '/student/lessons/current' : '/student/lessons'}
                  className="sp-display inline-flex items-center gap-1.5 px-5 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
                  style={{
                    background: 'var(--gold)',
                    color: 'var(--ink)',
                    border: '2px solid var(--gold-deep)',
                    borderRadius: 14,
                    boxShadow: '0 4px 0 var(--gold-deep)',
                    fontWeight: 700,
                  }}
                >
                  {nextLesson ? 'Davom etish →' : 'Darslarni ko‘rish →'}
                </Link>
              </div>
              <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                <div
                  className="flex items-center gap-1 px-2.5 py-1 sp-mono"
                  style={{
                    background: 'var(--ember)',
                    color: 'var(--bone)',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  🔥 {streak}
                </div>
                <div
                  className="sp-eyebrow"
                  style={{ color: 'var(--gold-soft)', fontSize: 9 }}
                >
                  kun zanjiri
                </div>
                {hasShield && (
                  <div
                    className="mt-2 px-2 py-1 sp-mono flex items-center gap-1"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      fontSize: 10,
                    }}
                  >
                    🛡 qalqon
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Three tracks ── */}
        <SectionTitle action={<span className="sp-eyebrow">mentor bahosi</span>}>
          Yo‘nalishlar
        </SectionTitle>
        <div className="px-4 grid grid-cols-3 gap-2">
          {tracks.map((t) => {
            const tone = STATUS_TONE[t.value] ?? STATUS_TONE[''];
            return (
              <div
                key={t.code}
                className="p-3 flex flex-col gap-2"
                style={{
                  background: 'var(--bone)',
                  border: '1.5px solid var(--line)',
                  borderRadius: 'var(--r-3)',
                  boxShadow: 'var(--shadow-1)',
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="sp-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)' }}>
                    {t.code}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: tone.dot }}
                  />
                </div>
                <div className="sp-display text-[13px] leading-tight" style={{ color: 'var(--ink)' }}>
                  {t.label}
                </div>
                <div className="sp-eyebrow" style={{ fontSize: 9, color: tone.noteColor }}>
                  {tone.note}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Quick actions ── */}
        <SectionTitle>Tezkor amallar</SectionTitle>
        <div className="px-4 grid grid-cols-2 gap-2.5">
          <QAction
            href="/student/review"
            bg="var(--ember)"
            deep="var(--ember-deep)"
            emoji="📚"
            title="Kunlik takror"
            sub={reviewItems.length > 0 ? `${reviewItems.length} ta so‘z` : 'hozircha yo‘q'}
          />
          <QAction
            href="/student/duels"
            bg="var(--gold)"
            deep="var(--gold-deep)"
            ink="var(--ink)"
            emoji="⚔"
            title="Duel"
            sub="do‘st bilan musobaqa"
          />
          <QAction
            href="/student/letters"
            bg="var(--sky)"
            deep="#2D5872"
            emoji="🔤"
            title="Harflar"
            sub="kolleksiya"
          />
          <QAction
            href="/student/certificates"
            bg="var(--leaf-2)"
            deep="var(--leaf-deep)"
            emoji="🏅"
            title="Sertifikatlar"
            sub={bestCert ? `${bestCert} daraja` : 'hali yo‘q'}
          />
        </div>

        {/* ── Lesson roadmap preview ── */}
        <SectionTitle
          action={
            <Link
              href="/student/lessons"
              className="sp-display text-xs"
              style={{ color: 'var(--leaf)', fontWeight: 600 }}
            >
              Hammasi →
            </Link>
          }
        >
          Dars yo‘lim
        </SectionTitle>
        <div className="px-4">
          <div
            className="p-4"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-3)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            <MiniRoadmap step={currentStep} />
          </div>
        </div>

        {/* ── Friends activity preview ── */}
        <SectionTitle
          action={
            <Link
              href="/student/lenta"
              className="sp-display text-xs"
              style={{ color: 'var(--leaf)', fontWeight: 600 }}
            >
              Hammasi →
            </Link>
          }
        >
          Do‘stlar faolligi
        </SectionTitle>
        <div className="px-4">
          <SocialFeed />
        </div>
      </div>
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────────────────────── */

/**
 * Prominent daily-video card. Dark "REC" treatment so it visually stands
 * apart from the rest of the (light) dashboard. Shows today's morning and
 * evening submission state and deep-links to the upload page.
 */
function DailyVideoCard({ status }: { status: VideoToday | null }) {
  const morningDone =
    status?.morningStatus === 'submitted' || status?.morningStatus === 'late';
  const eveningDone =
    status?.eveningStatus === 'submitted' || status?.eveningStatus === 'late';
  const actionNow =
    (!!status?.canUploadMorning && !morningDone) ||
    (!!status?.canUploadEvening && !eveningDone);
  const bothDone = morningDone && eveningDone;

  const heading = bothDone
    ? 'Bugungi videolar topshirildi 🎉'
    : actionNow
      ? 'Hozir video yuklang'
      : 'Ertalabki va kechki video';
  const cta = bothDone
    ? 'Videolarni ko‘rish →'
    : actionNow
      ? 'Hozir yuklash →'
      : 'Video bo‘limi →';

  return (
    <Link
      href="/student/checkin"
      className="block relative overflow-hidden active:translate-y-[2px] transition-transform"
      style={{
        background: 'var(--ink)',
        color: 'var(--bone)',
        borderRadius: 'var(--r-4)',
        boxShadow: '0 6px 0 rgba(0,0,0,0.32)',
      }}
    >
      <div className="relative p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex items-center justify-center w-2.5 h-2.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full motion-safe:animate-ping"
              style={{ background: 'var(--ember)' }}
              aria-hidden
            />
            <span
              className="relative inline-flex rounded-full w-2.5 h-2.5"
              style={{ background: 'var(--ember)' }}
            />
          </span>
          <span className="sp-eyebrow" style={{ color: 'var(--gold-soft)' }}>
            Kunlik video
          </span>
        </div>
        <h2 className="sp-display text-xl leading-tight mb-3.5">{heading}</h2>
        <div className="flex gap-2 mb-4">
          <VideoSlotChip label="Ertalabki" state={status?.morningStatus ?? null} />
          <VideoSlotChip label="Kechki" state={status?.eveningStatus ?? null} />
        </div>
        <span
          className="sp-display inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px]"
          style={{
            background: bothDone ? 'rgba(255,255,255,0.14)' : 'var(--gold)',
            color: bothDone ? 'var(--bone)' : 'var(--ink)',
            border: bothDone
              ? '2px solid rgba(255,255,255,0.2)'
              : '2px solid var(--gold-deep)',
            borderRadius: 14,
            boxShadow: bothDone ? 'none' : '0 4px 0 var(--gold-deep)',
            fontWeight: 700,
          }}
        >
          <Video size={16} />
          {cta}
        </span>
      </div>
    </Link>
  );
}

function VideoSlotChip({
  label,
  state,
}: {
  label: string;
  state: VideoSlotStatus;
}) {
  const done = state === 'submitted' || state === 'late';
  const tone = done
    ? {
        dot: 'var(--leaf-2)',
        text: state === 'late' ? 'kech topshirildi' : 'topshirildi',
      }
    : state === 'missed'
      ? { dot: 'var(--ember)', text: "o‘tkazib yuborildi" }
      : { dot: 'var(--gold)', text: 'kutilmoqda' };

  return (
    <div
      className="flex-1 flex items-center gap-2 px-3 py-2 min-w-0"
      style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 'var(--r-2)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: tone.dot }}
      />
      <div className="min-w-0">
        <div className="sp-display text-[13px] leading-tight">{label}</div>
        <div
          className="text-[10px] leading-tight truncate"
          style={{ color: 'var(--bone)', opacity: 0.7 }}
        >
          {tone.text}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 flex items-center justify-between mt-5 mb-2.5">
      <h3
        className="sp-display text-sm uppercase m-0"
        style={{ letterSpacing: '0.06em', color: 'var(--ink-3)' }}
      >
        {children}
      </h3>
      {action}
    </div>
  );
}

function QAction({
  href,
  bg,
  deep,
  emoji,
  title,
  sub,
  ink = 'var(--bone)',
}: {
  href: string;
  bg: string;
  deep: string;
  emoji: string;
  title: string;
  sub: string;
  ink?: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 p-3.5 active:translate-y-[2px] transition-transform"
      style={{
        background: bg,
        color: ink,
        border: `2px solid ${deep}`,
        borderRadius: 'var(--r-3)',
        boxShadow: `0 4px 0 ${deep}`,
      }}
    >
      <span className="text-[28px] leading-none">{emoji}</span>
      <span className="sp-display text-[15px]">{title}</span>
      <span className="text-[11px] opacity-80">{sub}</span>
    </Link>
  );
}

/**
 * Inline lesson roadmap — a window of 8 nodes around the student's
 * current step. Derived purely from the real completed-lesson count
 * (no extra fetch): nodes before the current step are done, the
 * current step is highlighted, the rest are open.
 */
function MiniRoadmap({ step }: { step: number }) {
  const start = Math.max(1, step - 4);
  const nodes = Array.from({ length: 8 }, (_, i) => {
    const n = start + i;
    const state = n < step ? 'done' : n === step ? 'current' : 'open';
    return { n, state };
  });
  return (
    <div className="flex justify-between items-center gap-1">
      {nodes.map((d, i) => (
        <div key={d.n} className="flex items-center flex-1 last:flex-none">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center sp-mono shrink-0"
            style={{
              background:
                d.state === 'done'
                  ? 'var(--leaf)'
                  : d.state === 'current'
                    ? 'var(--ember)'
                    : 'var(--bone-2)',
              border: `2px solid ${d.state === 'open' ? 'var(--line)' : 'var(--ink)'}`,
              color:
                d.state === 'open' ? 'var(--ink-3)' : 'var(--bone)',
              fontSize: 10,
              fontWeight: 700,
              boxShadow: d.state === 'current' ? '0 0 0 4px var(--ember-soft)' : 'none',
            }}
          >
            {d.state === 'done' ? '✓' : d.n}
          </div>
          {i < nodes.length - 1 && (
            <div
              className="flex-1 h-0.5 mx-0.5"
              style={{
                background: d.state === 'done' ? 'var(--leaf)' : 'var(--paper-3)',
                borderRadius: 1,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
