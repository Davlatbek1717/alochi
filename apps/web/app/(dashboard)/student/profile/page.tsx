'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Star,
  Flame,
  GraduationCap,
  Send,
  ScanFace,
  Pencil,
  Save,
  BookOpen,
  Trophy,
  Sparkles,
  Crown,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Modal, Skeleton, useToast } from '@/components/ui';
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

const LEAGUE_LABELS: Record<string, { label: string; color: string }> = {
  bronze: { label: 'Bronza', color: 'from-[#a16207] to-[#78350f]' },
  silver: { label: 'Kumush', color: 'from-[#94a3b8] to-[#475569]' },
  gold: { label: 'Oltin', color: 'from-[#fbbf24] to-[#d97706]' },
  platinum: { label: 'Platina', color: 'from-[#7dd3fc] to-[#0369a1]' },
  diamond: { label: 'Olmos', color: 'from-[#67e8f9] to-[#155e75]' },
};

function formatMember(date?: string | null): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    const months = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'Iyun',
      'Iyul',
      'Avgust',
      'Sentabr',
      'Oktabr',
      'Noyabr',
      'Dekabr',
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return '';
  }
}

export default function StudentProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xp, setXp] = useState<XpData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [lettersOwned, setLettersOwned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit state (modal sheet)
  const [editing, setEditing] = useState(false);
  const [parentTg, setParentTg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="min-h-full bg-[#fffaf0]">
        <div className="bg-white border-b-[1.5px] border-[#ede9e1] px-5 pt-5 pb-6">
          <Skeleton theme="light" className="h-8 w-48 mb-3" />
          <Skeleton theme="light" className="h-4 w-32" />
        </div>
        <div className="px-4 pt-5 space-y-3 max-w-lg mx-auto">
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
        </div>
      </div>
    );
  }

  const tgLink =
    profile && BOT_USERNAME
      ? `https://t.me/${BOT_USERNAME}?start=${profile.tenantId}:${profile.id}`
      : '';

  // Determine league band from total XP — Duolingo-style tiers.
  const totalXp = xp?.totalXp ?? 0;
  const leagueKey =
    totalXp >= 5000
      ? 'diamond'
      : totalXp >= 2500
        ? 'platinum'
        : totalXp >= 1000
          ? 'gold'
          : totalXp >= 300
            ? 'silver'
            : 'bronze';
  const league = LEAGUE_LABELS[leagueKey];

  // Build a small set of achievements from existing data
  const achievements: Achievement[] = [];
  if ((streak?.streak ?? 0) >= 7) {
    achievements.push({
      id: 'streak-7',
      title: '7 kun streak',
      icon: <Flame size={22} />,
      rarity: (streak?.streak ?? 0) >= 30 ? 'legendary' : 'rare',
    });
  }
  if (totalXp >= 1000) {
    achievements.push({
      id: 'xp-1k',
      title: '1000 XP',
      icon: <Star size={22} />,
      rarity: totalXp >= 5000 ? 'legendary' : 'rare',
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
    <div className="min-h-full bg-[#fffaf0] pb-8">
      {/* Cream header with avatar + Aloqush */}
      <div className="bg-white border-b-[1.5px] border-[#ede9e1] px-5 pt-6 pb-7 relative overflow-hidden">
        <div className="relative z-10 flex items-start gap-4 max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#fbbf24] to-[#d97706] border-[3px] border-white shadow-lg flex items-center justify-center text-white font-extrabold text-3xl shrink-0">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#0f172a] text-2xl font-extrabold truncate font-[var(--font-nunito)]">
              {profile.name}
            </h1>
            <p className="text-[#64748b] text-xs truncate">@{profile.login}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {profile.branch?.name && (
                <span className="inline-flex items-center gap-1 text-xs text-[#64748b] bg-[#fffaf0] border border-[#ede9e1] rounded-full px-2 py-0.5">
                  <GraduationCap size={11} /> {profile.branch.name}
                </span>
              )}
              {profile.createdAt && formatMember(profile.createdAt) && (
                <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider">
                  {formatMember(profile.createdAt)} dan
                </span>
              )}
            </div>
          </div>
          <div className="hidden sm:block shrink-0">
            <Mascot expression="happy" size={80} />
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-5 max-w-lg mx-auto">
        {/* League badge */}
        <div
          className={`relative rounded-[20px] p-4 text-white bg-gradient-to-br ${league.color} shadow-lg overflow-hidden`}
        >
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="relative z-10 flex items-center gap-3">
            <Crown size={28} fill="white" />
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold">
                Liga
              </p>
              <p className="text-2xl font-extrabold">{league.label}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold">
                Daraja
              </p>
              <p className="text-xl font-extrabold">{xp?.level ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Animated stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Star size={18} className="text-[#fbbf24]" />}
            value={totalXp}
            label="XP"
          />
          <StatCard
            icon={<Flame size={18} className="text-[#ef4444]" />}
            value={streak?.streak ?? 0}
            label="Streak"
          />
          <StatCard
            icon={<Award size={18} className="text-[#ce82ff]" />}
            value={certs.length}
            label="Sertifikat"
          />
          <StatCard
            icon={<BookOpen size={18} className="text-[#1cb0f6]" />}
            value={lessonsCompleted}
            label="Darslar"
          />
          <StatCard
            icon={<Sparkles size={18} className="text-[#f59e0b]" />}
            value={lettersOwned}
            label="Harflar"
          />
          <StatCard
            icon={<Trophy size={18} className="text-[#10b981]" />}
            value={xp?.nextLevelXp ?? 0}
            label="Keyingi"
          />
        </div>

        {/* Achievements */}
        <section className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
              Yutuqlar
            </p>
            <span className="text-[10px] text-[#94a3b8]">
              {achievements.length} ta
            </span>
          </div>
          <AchievementCarousel items={achievements.slice(0, 6)} />
        </section>

        {/* Profile fields */}
        <section className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
              Maʼlumotlar
            </p>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-bold text-[#1cb0f6] hover:underline"
            >
              <Pencil size={12} /> Tahrirlash
            </button>
          </div>
          <div className="space-y-3">
            <Field
              label="Ota-ona Telegram"
              value={profile.parentTelegramId || 'Bogʻlanmagan'}
            />
            <Field
              label="Tugʻilgan sana"
              value={
                profile.birthDate
                  ? profile.birthDate.slice(0, 10)
                  : 'Belgilanmagan'
              }
            />
            {profile.group?.name && (
              <Field label="Guruh" value={profile.group.name} />
            )}
          </div>
        </section>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <QuickLink
            href="/student/certificates"
            icon={<Award size={18} className="text-[#fbbf24]" />}
            label="Sertifikatlar"
          />
          <QuickLink
            href="/student/groups"
            icon={<GraduationCap size={18} className="text-[#10b981]" />}
            label="Guruh"
          />
          <QuickLink
            href="/profile/enroll"
            icon={
              <ScanFace
                size={18}
                className={
                  profile.faceEnrolled ? 'text-[#10b981]' : 'text-[#94a3b8]'
                }
              />
            }
            label={profile.faceEnrolled ? 'Yuz ID' : 'Yuz roʻyxat'}
          />
          {tgLink && !profile.parentTelegramLinked && (
            <a
              href={tgLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 flex items-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <Send size={18} className="text-[#1cb0f6]" />
              <span className="text-sm font-bold text-[#0f172a]">Ota-ona TG</span>
            </a>
          )}
        </div>
      </div>

      {/* Edit profile bottom-sheet modal */}
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
              className="w-full bg-[#fffaf0] border-[1.5px] border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#1cb0f6]"
            />
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
              className="w-full bg-[#fffaf0] border-[1.5px] border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#1cb0f6]"
            />
          </div>
        </div>
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
    <div className="bg-white rounded-[16px] border-[1.5px] border-[#ede9e1] p-3 text-center motion-safe:[animation:count-up-fade_400ms_ease-out]">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xl font-extrabold text-[#0f172a]">
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

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 flex items-center gap-2 hover:scale-[1.02] transition-transform"
    >
      {icon}
      <span className="text-sm font-bold text-[#0f172a]">{label}</span>
    </Link>
  );
}
