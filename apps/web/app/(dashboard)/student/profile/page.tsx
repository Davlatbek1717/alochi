'use client';
import { useCallback, useEffect, useState } from 'react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  GraduationCap,
  Send,
  ScanFace,
  Pencil,
  Save,
  BookOpen,
  Trophy,
  Sparkles,
  Crown,
  ChevronRight,
  LogOut,
  Mail,
  Volume2,
  Mic,
} from 'lucide-react';
import { StreakFlame } from '../_components/StreakFlame';
import { apiRequest } from '@/lib/api';
import { Mascot, Modal, Skeleton, Switch, useToast } from '@/components/ui';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound';
import { getWebSpeechPreference, setWebSpeechPreference } from '@/lib/speech';
import { AnimatedCounter } from '../_components/AnimatedCounter';
import {
  AchievementCarousel,
  type Achievement,
} from '../_components/AchievementCarousel';

type Profile = {
  id: string;
  name: string;
  login: string;
  role: string;
  tenantId: string;
  faceEnrolled: boolean;
  parentTelegramLinked: boolean;
  parentTelegramId?: string | null;
  telegramId?: string | number | null;
  birthDate?: string | null;
  groupId?: string | null;
  branchId?: string | null;
  group?: { id: string; name?: string } | null;
  branch?: { id: string; name?: string } | null;
  createdAt?: string | null;
};

type XpData = { totalXp: number; level: string; nextLevelXp: number };
type StreakData = { streak: number; hasShield: boolean };
type Certificate = { id: string; level?: string };
type LettersResp = Array<{ id: string; owned: boolean }>;
type CityData = { lessonsCompleted?: number };

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? '';

const LEAGUE_TIERS = [
  { key: 'bronze', label: 'Bronza', minXp: 0, color: 'from-[#a16207] to-[#78350f]' },
  { key: 'silver', label: 'Kumush', minXp: 300, color: 'from-[#94a3b8] to-[#475569]' },
  { key: 'gold', label: 'Oltin', minXp: 1000, color: 'from-[#fbbf24] to-[#d97706]' },
  { key: 'platinum', label: 'Platina', minXp: 2500, color: 'from-[#7dd3fc] to-[#0369a1]' },
  { key: 'diamond', label: 'Olmos', minXp: 5000, color: 'from-[#67e8f9] to-[#155e75]' },
] as const;

type LeagueTier = (typeof LEAGUE_TIERS)[number];

function pickLeague(totalXp: number): {
  current: LeagueTier;
  next: LeagueTier | null;
} {
  // Highest tier whose minXp threshold is met.
  let current: LeagueTier = LEAGUE_TIERS[0];
  let next: LeagueTier | null = null;
  for (let i = 0; i < LEAGUE_TIERS.length; i++) {
    if (totalXp >= LEAGUE_TIERS[i].minXp) {
      current = LEAGUE_TIERS[i];
      next = LEAGUE_TIERS[i + 1] ?? null;
    }
  }
  return { current, next };
}

/**
 * Render the parent Telegram link as something a child can read at a
 * glance. Numeric IDs become "Ulangan" (with the raw ID hidden in the
 * tooltip for support), `@username` strings render as-is, and a missing
 * value renders as "Bogʻlanmagan".
 */
function formatParentTelegram(value: string | null | undefined): string {
  if (!value) return 'Bogʻlanmagan';
  const trimmed = value.trim();
  if (!trimmed) return 'Bogʻlanmagan';
  if (trimmed.startsWith('@')) return trimmed;
  // All-digit Telegram numeric IDs are useless to a child reader.
  if (/^\d+$/.test(trimmed)) return 'Ulangan';
  return trimmed;
}

function formatMember(date?: string | null): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    const months = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return '';
  }
}

export default function StudentProfilePage() {
  const router = useRouter();
  const toast = useToast();
    const [profile, setProfile] = useState<Profile | null>(null);
  const [xp, setXp] = useState<XpData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [lettersOwned, setLettersOwned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit modal
  const [editing, setEditing] = useState(false);
  const [parentTg, setParentTg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Logout confirmation
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Settings
  const [soundOn, setSoundOn] = useState(true);
  const [webSpeechOn, setWebSpeechOn] = useState(true);
  useEffect(() => {
    setSoundOn(isSoundEnabled());
    setWebSpeechOn(getWebSpeechPreference());
  }, []);
  function toggleSound(next: boolean) {
    setSoundOn(next);
    setSoundEnabled(next);
  }
  function toggleWebSpeech(next: boolean) {
    setWebSpeechOn(next);
    setWebSpeechPreference(next);
  }

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Profile>('/users/my-profile', {}, token),
      apiRequest<XpData>('/gamification/xp', {}, token).catch(
        () => ({ data: null as XpData | null }),
      ),
      apiRequest<StreakData>('/gamification/streak', {}, token).catch(
        () => ({ data: null as StreakData | null }),
      ),
      apiRequest<Certificate[]>('/gamification/certificates', {}, token).catch(
        () => ({ data: [] as Certificate[] }),
      ),
      apiRequest<LettersResp>('/letters/mine', {}, token).catch(
        () => ({ data: [] as LettersResp }),
      ),
      apiRequest<CityData>('/gamification/city', {}, token).catch(
        () => ({ data: null as CityData | null }),
      ),
    ])
      .then(([p, x, s, c, l, city]) => {
        setProfile(p.data);
        if (x.data) setXp(x.data);
        if (s.data) setStreak(s.data);
        setCerts(c.data ?? []);
        setLettersOwned((l.data ?? []).filter((it) => it.owned).length);
        setLessonsCompleted(city.data?.lessonsCompleted ?? 0);
        setParentTg(p.data?.parentTelegramId ?? '');
        setBirthDate(p.data?.birthDate ? p.data.birthDate.slice(0, 10) : '');
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh XP, streak and certificate data whenever the user returns to this
  // tab so the profile never shows stale gamification numbers.
  useFocusRevalidate(load);

  // Real-time: revalidate on XP or certificate socket push.
  useRevalidateOnEvent(['xp:updated', 'cert:earned'], load);

  async function saveEdit() {
    if (!profile) return;
    setSaving(true);
    try {
      await apiRequest(
        `/users/${profile.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            parentTelegramId: parentTg || null,
            birthDate: birthDate || null,
          }),
        },
        localStorage.getItem('accessToken') ?? '',
      );
      toast.success('Saqlandi');
      setEditing(false);
      setProfile({
        ...profile,
        parentTelegramId: parentTg || null,
        birthDate: birthDate || null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    // Clear stored creds and bounce to login. Mirrors the auto-bounce
    // path in apiRequest so the user lands in the same place.
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } catch {
      /* private mode / quota — ignore */
    }
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#fffaf0]">
        <div className="bg-white border-b-[1.5px] border-[#ede9e1] px-5 pt-5 pb-6">
          <Skeleton theme="light" className="h-8 w-48 mb-3" />
          <Skeleton theme="light" className="h-4 w-32" />
        </div>
        <div className="px-4 pt-5 space-y-3 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" theme="light" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-full bg-[#fffaf0] flex items-center justify-center p-6">
        <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-8 text-center max-w-sm w-full space-y-4">
          <Mascot expression="sad" size={120} className="mx-auto" />
          <p className="text-[#0f172a] font-bold text-lg">Profilni yuklab boʻlmadi</p>
          <p className="text-[#64748b] text-sm">{error || 'Xato yuz berdi'}</p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#58cc02] text-white font-extrabold text-sm px-4 py-2.5 rounded-xl border-b-[3px] border-[#46a302] active:translate-y-[1px] active:border-b-[1px] hover:brightness-105 transition-all min-h-[44px]"
            >
              Qayta urinish
            </button>
            <Link
              href="/student"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#0f172a] font-extrabold text-sm px-4 py-2.5 rounded-xl border-[1.5px] border-[#ede9e1] hover:bg-[#fffaf0] transition-colors min-h-[44px]"
            >
              Bosh sahifaga
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tgLink =
    profile && BOT_USERNAME
      ? `https://t.me/${BOT_USERNAME}?start=${profile.tenantId}_${profile.id}`
      : '';

  const totalXp = xp?.totalXp ?? 0;
  const { current: league, next: nextLeague } = pickLeague(totalXp);
  const leagueProgress = nextLeague
    ? Math.min(
        1,
        (totalXp - league.minXp) / (nextLeague.minXp - league.minXp),
      )
    : 1;

  // Achievements only show when they unlock — no empty section.
  const achievements: Achievement[] = [];
  if ((streak?.streak ?? 0) >= 7) {
    achievements.push({
      id: 'streak-7',
      title: '7 kun streak',
      icon: <StreakFlame streak={streak?.streak ?? 0} size={22} showLabel={false} />,
      rarity: (streak?.streak ?? 0) >= 30 ? 'legendary' : 'rare',
    });
  }
  if (lessonsCompleted >= 10) {
    achievements.push({
      id: 'lessons-10',
      title: `${lessonsCompleted} dars`,
      icon: <BookOpen size={22} />,
      rarity: lessonsCompleted >= 100 ? 'legendary' : 'common',
    });
  }
  if (certs.length > 0) {
    achievements.push({
      id: 'cert',
      title: 'Sertifikat',
      icon: <Trophy size={22} />,
      rarity: certs.some((c) => c.level === 'gold' || c.level === 'diamond')
        ? 'legendary'
        : 'common',
    });
  }
  if (lettersOwned >= 12) {
    achievements.push({
      id: 'letters',
      title: `${lettersOwned} harf`,
      icon: <Sparkles size={22} />,
      rarity: lettersOwned >= 30 ? 'legendary' : 'rare',
    });
  }
  if (profile.faceEnrolled) {
    achievements.push({
      id: 'face',
      title: 'Yuz ID',
      icon: <ScanFace size={22} />,
      rarity: 'common',
    });
  }

  return (
    <div className="min-h-full bg-[#fffaf0] pb-4">
      {/* Hero banner — full width */}
      <div className="bg-white border-b-[1.5px] border-[#ede9e1] px-5 pt-6 pb-5 md:px-8 md:py-8 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4 max-w-lg mx-auto md:max-w-5xl lg:max-w-6xl">
          <div
            className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br ${league.color} border-[3px] border-white shadow-lg flex items-center justify-center text-white font-extrabold text-3xl md:text-4xl shrink-0`}
            aria-hidden
          >
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-[#0f172a] text-2xl md:text-3xl font-extrabold truncate"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {profile.name}
            </h1>
            <p className="text-[#64748b] text-xs md:text-sm truncate font-semibold">
              @{profile.login}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {profile.branch?.name && (
                <span className="inline-flex items-center gap-1 text-[11px] md:text-xs text-[#64748b] bg-[#fffaf0] border border-[#ede9e1] rounded-full px-2 py-0.5 font-bold">
                  <GraduationCap size={11} /> {profile.branch.name}
                </span>
              )}
              {profile.group?.name && (
                <span className="inline-flex items-center gap-1 text-[11px] md:text-xs text-[#46a302] bg-[#dcfce7] border border-[#bbf7d0] rounded-full px-2 py-0.5 font-bold">
                  {profile.group.name}
                </span>
              )}
              {profile.createdAt && formatMember(profile.createdAt) && (
                <span className="text-[10px] md:text-xs text-[#94a3b8] uppercase tracking-wider font-bold">
                  {formatMember(profile.createdAt)} dan
                </span>
              )}
            </div>
          </div>
          <div className="hidden sm:block shrink-0">
            <Mascot expression="happy" size={72} className="md:!w-[96px] md:!h-[96px]" />
          </div>
        </div>
      </div>

      {/* Tablet: left sticky (avatar stats) + right (details) */}
      <div className="max-w-lg mx-auto md:max-w-5xl lg:max-w-6xl px-4 md:px-6 pt-5 pb-6 md:flex md:gap-6 lg:gap-8 md:items-start">

        {/* LEFT column — sticky on md+: league + stats */}
        <div className="md:w-72 lg:w-80 shrink-0 md:sticky md:top-20 space-y-5 mb-5 md:mb-0">
        {/* League card with progress to next */}
        <div
          className={`relative rounded-3xl p-4 md:p-5 text-white bg-gradient-to-br ${league.color} shadow-lg overflow-hidden md:hover:-translate-y-0.5 transition-all`}
        >
          <div
            aria-hidden
            className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10"
          />
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3">
              <Crown size={28} fill="white" />
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold">
                  Liga
                </p>
                <p className="text-2xl font-extrabold leading-tight">
                  {league.label}
                </p>
              </div>
            </div>
            {nextLeague ? (
              <>
                <div className="h-1.5 bg-white/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(leagueProgress * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] font-bold opacity-90">
                  {nextLeague.label} ligasiga ko&apos;tarilish uchun davom eting
                </p>
              </>
            ) : (
              <p className="text-[11px] font-bold opacity-90">
                Eng yuqori liga — qoyilman! 🏆
              </p>
            )}
          </div>
        </div>

        {/* Compact stat grid */}
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <StatCard
            icon={
              <StreakFlame
                streak={streak?.streak ?? 0}
                hasShield={streak?.hasShield ?? false}
                size={18}
                showLabel={false}
              />
            }
            value={streak?.streak ?? 0}
            label="Streak"
          />
          <StatCard
            icon={<BookOpen size={18} className="text-[#1cb0f6]" />}
            value={lessonsCompleted}
            label="Darslar"
          />
          <StatCard
            icon={<Award size={18} className="text-[#ce82ff]" />}
            value={certs.length}
            label="Sertif."
          />
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <section className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
                Yutuqlar
              </p>
              <span className="text-[10px] text-[#94a3b8] font-bold">
                {achievements.length} ta
              </span>
            </div>
            <AchievementCarousel items={achievements.slice(0, 6)} />
          </section>
        )}
        </div>{/* end LEFT column */}

        {/* RIGHT column — details, settings, links */}
        <div className="flex-1 min-w-0 space-y-5">
        {/* Profile fields with edit button */}
        <section className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
              Maʼlumotlar
            </p>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-bold text-[#46a302] hover:underline min-h-[44px] px-2"
            >
              <Pencil size={12} /> Tahrirlash
            </button>
          </div>
          <div className="space-y-3">
            <Field
              label={'Ota-ona Telegram'}
              value={formatParentTelegram(profile.parentTelegramId)}
            />
            <Field
              label={'Tug\'ilgan sana'}
              value={
                profile.birthDate
                  ? profile.birthDate.slice(0, 10)
                  : 'Belgilanmagan'
              }
            />
            {tgLink && !profile.parentTelegramLinked && (
              <a
                href={tgLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-[#1cb0f6]/10 border border-[#1cb0f6]/20 rounded-xl px-3 py-2.5 flex items-center gap-2 hover:bg-[#1cb0f6]/15 transition-colors"
              >
                <Send size={14} className="text-[#1cb0f6] shrink-0" />
                <span className="text-xs font-bold text-[#0369a1] flex-1">
                  Ota-onangizni Telegram orqali ulang
                </span>
                <ChevronRight size={14} className="text-[#1cb0f6] shrink-0" />
              </a>
            )}
          </div>
        </section>

        {/* Settings */}
        <section className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-5 space-y-4">
          <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
            Sozlamalar
          </p>
          <SettingRow
            icon={<Volume2 size={16} className="text-[#fbbf24]" />}
            title="Ovoz effektlari"
            sub="Toʻgʻri javob, xato va daraja ovozlari"
            checked={soundOn}
            onChange={toggleSound}
            label="Ovoz effektlari"
          />
          <div className="border-t border-[#f3eedf]" />
          <SettingRow
            icon={<Mic size={16} className="text-[#46a302]" />}
            title="Brauzer ovozi (Web Speech)"
            sub="Tezkor brauzer talaffuzi va ovoz aniqlash"
            checked={webSpeechOn}
            onChange={toggleWebSpeech}
            label="Brauzer ovozi"
          />
        </section>

        {/* Telegram bot linking section */}
        <section className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-[#1cb0f6]/10 flex items-center justify-center">
              <Send size={15} className="text-[#1cb0f6]" />
            </div>
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
              Telegram bot ulash
            </p>
          </div>
          {profile.telegramId ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                Bot ulangan. Har kuni video tashlang.
              </p>
              <p className="text-xs text-[#64748b]">
                06:00–06:30 ertalabki video • 18:00–22:00 kechki video
              </p>
            </div>
          ) : BOT_USERNAME ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-[#64748b] leading-relaxed">
                Har kuni ikki marta video tashlashingiz kerak:<br />
                <strong>Ertalab 06:00–06:30</strong> va <strong>Kechki 18:00–22:00</strong>.<br />
                Faqat bot ichida yozilgan video qabul qilinadi (forward qilinmagan).
              </p>
              <a
                href={`https://t.me/${BOT_USERNAME}?start=link_${profile.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#1cb0f6] text-white font-extrabold text-sm px-4 py-2.5 rounded-xl hover:bg-[#0ea5e9] transition-colors min-h-[44px]"
              >
                <Send size={14} /> Botni ulash
              </a>
            </div>
          ) : null}
        </section>

        {/* Account quick links */}
        <section className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-2 divide-y divide-[#f3eedf]">
          <AccountRow
            href="/student/certificates"
            icon={<Award size={18} className="text-[#fbbf24]" />}
            title="Sertifikatlar"
            sub={`${certs.length} ta sertifikat`}
          />
          <AccountRow
            href="/student/letters"
            icon={<Mail size={18} className="text-[#10b981]" />}
            title="Harflar kolleksiyasi"
            sub={`${lettersOwned} ta to'plangan`}
          />
          <AccountRow
            href="/student/groups"
            icon={<GraduationCap size={18} className="text-[#1cb0f6]" />}
            title="Mening guruhim"
            sub={profile.group?.name ?? "Guruh tayinlanmagan"}
          />
          <AccountRow
            href="/profile/enroll"
            icon={
              <ScanFace
                size={18}
                className={
                  profile.faceEnrolled ? 'text-[#10b981]' : 'text-[#94a3b8]'
                }
              />
            }
            title={profile.faceEnrolled ? 'Yuz ID — faol' : 'Yuz ID ro\'yxat'}
            sub={profile.faceEnrolled ? "Davomatga ulangan" : "Bir martalik ro'yxatdan o'tish"}
          />
        </section>

        {/* Logout */}
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full bg-white rounded-3xl border-[1.5px] border-[#fecaca] p-4 flex items-center justify-center gap-2 text-sm font-extrabold text-[#dc2626] hover:bg-rose-50 transition-colors min-h-[44px]"
        >
          <LogOut size={16} /> {'Profildan chiqish'}
        </button>
        </div>{/* end RIGHT column */}
      </div>{/* end 2-col flex */}

      {/* Edit profile modal */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Profilni tahrirlash"
        theme="light"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm font-bold text-[#64748b] hover:text-[#0f172a]"
            >
              Bekor qilish
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-extrabold text-white bg-[#58cc02] border-b-[3px] border-[#46a302] hover:brightness-105 active:translate-y-[1px] active:border-b-[1px] disabled:bg-[#e8e0d0] disabled:border-[#cbbf9c] flex items-center gap-1.5"
            >
              <Save size={14} /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="parent-tg"
              className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1"
            >
              Ota-ona Telegram ID
            </label>
            <input
              id="parent-tg"
              value={parentTg}
              onChange={(e) => setParentTg(e.target.value)}
              placeholder="@username yoki raqam"
              className={`w-full bg-[#fffaf0] border-[1.5px] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none transition-colors ${
                parentTg && !/^(@[a-zA-Z0-9_]{4,}|\d{5,})$/.test(parentTg.trim())
                  ? 'border-rose-400 focus:border-rose-500'
                  : 'border-[#ede9e1] focus:border-[#46a302]'
              }`}
            />
            <p className="mt-1 text-[11px] text-[#94a3b8] font-semibold">
              Format: @username (kamida 4 harf) yoki raqamli ID (kamida 5 ta raqam)
            </p>
            {parentTg && !/^(@[a-zA-Z0-9_]{4,}|\d{5,})$/.test(parentTg.trim()) && (
              <p className="mt-0.5 text-[11px] text-rose-500 font-semibold">
                Noto&apos;g&apos;ri format. Masalan: @dadasi yoki 123456789
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="birth-date"
              className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1"
            >
              Tugʻilgan sana
            </label>
            <input
              id="birth-date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full bg-[#fffaf0] border-[1.5px] border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#46a302]"
            />
          </div>
        </div>
      </Modal>

      {/* Logout confirmation */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Profildan chiqasizmi?"
        theme="light"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setLogoutOpen(false)}
              className="px-4 py-2 text-sm font-bold text-[#64748b] hover:text-[#0f172a]"
            >
              Bekor qilish
            </button>
            <button
              onClick={confirmLogout}
              className="px-4 py-2 rounded-xl text-sm font-extrabold text-white bg-rose-600 border-b-[3px] border-rose-700 hover:brightness-105 active:translate-y-[1px] active:border-b-[1px] flex items-center gap-1.5"
            >
              <LogOut size={14} /> Chiqish
            </button>
          </>
        }
      >
        <p className="text-sm text-[#64748b] font-semibold leading-relaxed">
          Qayta kirish uchun login va parolingizni kiritishingiz kerak bo&apos;ladi.
        </p>
      </Modal>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 text-center motion-safe:[animation:count-up-fade_400ms_ease-out]">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-extrabold text-[#0f172a] leading-tight">
        <AnimatedCounter value={value} />
      </p>
      <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-bold">
        {label}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-sm text-[#0f172a] font-semibold">{value}</p>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  sub,
  checked,
  onChange,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#fffaf0] border border-[#ede9e1] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-[#0f172a]">{title}</p>
          <p className="text-xs text-[#64748b] font-semibold mt-0.5 leading-snug">
            {sub}
          </p>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function AccountRow({
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
      className="flex items-center gap-3 p-3 hover:bg-[#fffaf0] transition-colors rounded-2xl"
    >
      <div className="w-10 h-10 rounded-xl bg-[#fffaf0] border border-[#ede9e1] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-[#0f172a] truncate">{title}</p>
        <p className="text-[11px] text-[#64748b] font-semibold truncate">
          {sub}
        </p>
      </div>
      <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
    </Link>
  );
}
