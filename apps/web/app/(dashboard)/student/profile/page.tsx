'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Award, Star, Flame, GraduationCap, Send, ScanFace, Pencil, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, useToast } from '@/components/ui';

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
};

type XpData = { totalXp: number; level: string; nextLevelXp: number };
type StreakData = { streak: number; hasShield: boolean };
type Certificate = { id: string };

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? '';

export default function StudentProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xp, setXp] = useState<XpData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [parentTg, setParentTg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Profile>('/users/my-profile', {}, token),
      apiRequest<XpData>('/gamification/xp', {}, token).catch(() => ({ data: null as XpData | null })),
      apiRequest<StreakData>('/gamification/streak', {}, token).catch(() => ({ data: null as StreakData | null })),
      apiRequest<Certificate[]>('/gamification/certificates', {}, token).catch(() => ({ data: [] as Certificate[] })),
    ])
      .then(([p, x, s, c]) => {
        setProfile(p.data);
        if (x.data) setXp(x.data);
        if (s.data) setStreak(s.data);
        setCerts(c.data ?? []);
        setParentTg(p.data?.parentTelegramId ?? '');
        setBirthDate(p.data?.birthDate ? p.data.birthDate.slice(0, 10) : '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'))
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
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-8">
          <Skeleton className="h-6 w-48 mb-3" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="px-4 pt-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" theme="light" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <p className="text-white font-bold text-lg">Profil</p>
        </div>
        <div className="p-4">
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">
            {error || 'Xato yuz berdi'}
          </div>
        </div>
      </div>
    );
  }

  const tgLink = profile && BOT_USERNAME
    ? `https://t.me/${BOT_USERNAME}?start=${profile.tenantId}:${profile.id}`
    : '';

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#f59e0b]/15 border-2 border-[#f59e0b]/30 flex items-center justify-center">
            <User size={28} className="text-[#f59e0b]" />
          </div>
          <div>
            <p className="text-white text-xl font-bold">{profile.name}</p>
            <p className="text-[#94a3b8] text-xs">{profile.login}</p>
            {profile.group?.name && (
              <p className="text-[#94a3b8] text-xs mt-0.5">Guruh: {profile.group.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4 max-w-lg mx-auto">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 text-center">
            <Star size={16} className="mx-auto text-[#f59e0b] mb-1" />
            <p className="text-xl font-black text-[#0f172a] font-mono">{xp?.totalXp ?? 0}</p>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider">XP</p>
          </div>
          <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 text-center">
            <Flame size={16} className="mx-auto text-rose-500 mb-1" />
            <p className="text-xl font-black text-[#0f172a] font-mono">{streak?.streak ?? 0}</p>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Streak</p>
          </div>
          <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 text-center">
            <Award size={16} className="mx-auto text-violet-500 mb-1" />
            <p className="text-xl font-black text-[#0f172a] font-mono">{certs.length}</p>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Sertifikat</p>
          </div>
        </div>

        {xp && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">Daraja</p>
            <p className="text-2xl font-black text-[#0f172a]">{xp.level}</p>
            <p className="text-xs text-[#94a3b8]">Keyingi daraja: {xp.nextLevelXp} XP</p>
          </div>
        )}

        {/* Editable fields */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Maʼlumotlar</p>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs font-bold text-[#0d9488] hover:underline"
              >
                <Pencil size={12} /> Tahrirlash
              </button>
            ) : (
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1 text-xs font-bold text-white bg-[#0f172a] px-2.5 py-1 rounded-lg disabled:opacity-50"
              >
                <Save size={12} /> {saving ? '...' : 'Saqlash'}
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="parent-tg" className="block text-xs text-[#94a3b8] mb-1">
                Ota-ona Telegram ID
              </label>
              {editing ? (
                <input
                  id="parent-tg"
                  value={parentTg}
                  onChange={(e) => setParentTg(e.target.value)}
                  placeholder="@username yoki raqam"
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                />
              ) : (
                <p className="text-sm text-[#0f172a]">
                  {profile.parentTelegramId || <span className="text-[#94a3b8]">Bogʻlanmagan</span>}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="birth-date" className="block text-xs text-[#94a3b8] mb-1">
                Tugʻilgan sana
              </label>
              {editing ? (
                <input
                  id="birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                />
              ) : (
                <p className="text-sm text-[#0f172a]">
                  {profile.birthDate ? profile.birthDate.slice(0, 10) : <span className="text-[#94a3b8]">Belgilanmagan</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/student/certificates"
            className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 flex items-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <Award size={18} className="text-[#f59e0b]" />
            <span className="text-sm font-bold text-[#0f172a]">Sertifikatlar</span>
          </Link>
          <Link
            href="/student/groups"
            className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 flex items-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <GraduationCap size={18} className="text-[#0d9488]" />
            <span className="text-sm font-bold text-[#0f172a]">Guruh</span>
          </Link>
          <Link
            href="/profile/enroll"
            className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 flex items-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <ScanFace size={18} className={profile.faceEnrolled ? 'text-emerald-500' : 'text-[#94a3b8]'} />
            <span className="text-sm font-bold text-[#0f172a]">
              {profile.faceEnrolled ? 'Yuz ID' : 'Yuz roʻyxat'}
            </span>
          </Link>
          {tgLink && !profile.parentTelegramLinked && (
            <a
              href={tgLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-3 flex items-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <Send size={18} className="text-sky-500" />
              <span className="text-sm font-bold text-[#0f172a]">Ota-ona TG</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
