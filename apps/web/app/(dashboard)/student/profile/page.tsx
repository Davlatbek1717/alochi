'use client';
import { useCallback, useEffect, useState } from 'react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Save, LogOut, Video } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal, Switch, useToast } from '@/components/ui';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sound';
import { getWebSpeechPreference, setWebSpeechPreference } from '@/lib/speech';
import { Ustoz } from '@/components/Ustoz';

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

type StreakData = { streak: number; hasShield: boolean };
type Certificate = { id: string; level?: string };
type LettersResp = Array<{ id: string; owned: boolean }>;
type CityData = { lessonsCompleted?: number };


function formatParentTelegram(value: string | null | undefined): string {
  if (!value) return 'Bogʻlanmagan';
  const trimmed = value.trim();
  if (!trimmed) return 'Bogʻlanmagan';
  if (trimmed.startsWith('@')) return trimmed;
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
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [lettersOwned, setLettersOwned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [parentTg, setParentTg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

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
      .then(([p, s, c, l, city]) => {
        setProfile(p.data);
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

  useFocusRevalidate(load);
  useRevalidateOnEvent(['cert:earned'], load);

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
      <div className="sp-theme min-h-full p-4 space-y-4 max-w-lg mx-auto md:max-w-3xl">
        <div className="sp-skeleton h-40 w-full" style={{ borderRadius: 'var(--r-4)' }} />
        <div className="sp-skeleton h-24 w-full" style={{ borderRadius: 'var(--r-3)' }} />
        <div className="sp-skeleton h-48 w-full" style={{ borderRadius: 'var(--r-3)' }} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="sp-theme sp-paper-dots min-h-full flex items-center justify-center p-6">
        <div
          className="text-center max-w-sm w-full space-y-4 p-8"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-4)',
          }}
        >
          <Ustoz size={110} mood="oops" className="mx-auto" />
          <p className="sp-display text-lg" style={{ color: 'var(--ink)' }}>
            Profilni yuklab boʻlmadi
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {error || 'Xato yuz berdi'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="sp-display px-5 py-3 min-h-[44px]"
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

  const member = profile.createdAt ? formatMember(profile.createdAt) : '';

  return (
    <div className="sp-theme min-h-full pb-24">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto md:max-w-3xl">
        <Link
          href="/student"
          aria-label="Orqaga"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="sp-display text-xl leading-tight flex-1" style={{ color: 'var(--ink)' }}>
          Profil
        </h1>
      </header>

      <div className="px-4 max-w-lg mx-auto md:max-w-3xl space-y-4">
        {/* Profile header card */}
        <div
          className="p-5 flex flex-col items-center gap-2 text-center"
          style={{
            background: 'var(--bone-2)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-4)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <div
            className="w-[88px] h-[88px] rounded-full flex items-center justify-center sp-display"
            style={{
              background: 'var(--gold-tint)',
              border: '3px solid var(--gold-deep)',
              color: 'var(--gold-deep)',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="sp-display text-xl" style={{ color: 'var(--ink)' }}>
            {profile.name}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span
              className="sp-mono text-[11px] px-2.5 py-1"
              style={{
                background: 'var(--leaf-tint)',
                color: 'var(--leaf-deep)',
                border: '1px solid var(--leaf-soft)',
                borderRadius: 999,
              }}
            >
              @{profile.login}
            </span>
            {profile.branch?.name && (
              <span
                className="sp-mono text-[11px] px-2.5 py-1"
                style={{
                  background: 'var(--paper-2)',
                  color: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                }}
              >
                {profile.group?.name ? `${profile.group.name} · ` : ''}
                {profile.branch.name}
              </span>
            )}
          </div>
          {member && (
            <div className="sp-eyebrow" style={{ fontSize: 9 }}>
              {member} dan beri
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
            {[
              { k: 'Zanjir', v: streak?.streak ?? 0, sub: 'kun' },
              { k: 'Qadam', v: lessonsCompleted, sub: 'dars' },
              { k: 'Sertifikat', v: certs.length, sub: 'ta' },
            ].map((s) => (
              <div
                key={s.k}
                className="text-center p-2.5"
                style={{ background: 'var(--paper-2)', borderRadius: 'var(--r-2)' }}
              >
                <div className="sp-display text-xl" style={{ color: 'var(--leaf-deep)' }}>
                  {s.v}
                </div>
                <div className="sp-eyebrow" style={{ fontSize: 9 }}>
                  {s.k} · {s.sub}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily video checkin link */}
        <Link
          href="/student/checkin"
          className="flex items-center gap-4 p-4"
          style={{
            background: 'var(--leaf-tint)',
            border: '1.5px solid var(--leaf-soft)',
            borderRadius: 'var(--r-3)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--leaf)', color: 'var(--bone)' }}
          >
            <Video size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="sp-display text-sm" style={{ color: 'var(--leaf-deep)' }}>
              Kunlik video yuborish
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--leaf-deep)', opacity: 0.7 }}>
              Ertalab 05:00–06:30 • Kechki 18:00–22:00
            </p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--leaf-deep)' }} />
        </Link>

        {/* Settings list */}
        <section
          className="overflow-hidden"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-3)',
          }}
        >
          <div className="sp-eyebrow px-4 pt-3.5 pb-1">Sozlamalar</div>
          <SettingToggle
            emoji="🔔"
            label="Ota-ona Telegram"
            value={formatParentTelegram(profile.parentTelegramId)}
          />
          <SettingToggle
            emoji="🎂"
            label="Tug‘ilgan sana"
            value={profile.birthDate ? profile.birthDate.slice(0, 10) : 'Belgilanmagan'}
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <span style={{ fontSize: 20 }}>✏️</span>
            <span className="flex-1 text-sm" style={{ color: 'var(--ink)', fontWeight: 500 }}>
              Ma’lumotlarni tahrirlash
            </span>
            <ChevronRight size={16} style={{ color: 'var(--ink-4)' }} />
          </button>
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <span style={{ fontSize: 20 }}>🎵</span>
            <span className="flex-1 text-sm" style={{ color: 'var(--ink)', fontWeight: 500 }}>
              Ovoz effektlari
            </span>
            <Switch checked={soundOn} onChange={toggleSound} label="Ovoz effektlari" />
          </div>
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <span style={{ fontSize: 20 }}>🎙</span>
            <span className="flex-1 text-sm" style={{ color: 'var(--ink)', fontWeight: 500 }}>
              Brauzer ovozi
            </span>
            <Switch checked={webSpeechOn} onChange={toggleWebSpeech} label="Brauzer ovozi" />
          </div>
        </section>

        {/* Account links */}
        <section
          className="overflow-hidden"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-3)',
          }}
        >
          <AccountRow href="/student/checkin" emoji="📹" title="Kunlik video" sub="Ertalab va kechki" first />
          <AccountRow href="/student/attendance" emoji="📅" title="Davomatim" sub="Dars qatnashuvim" />
          <AccountRow href="/student/certificates" emoji="🏅" title="Sertifikatlar" sub={`${certs.length} ta`} />
          <AccountRow href="/student/letters" emoji="🔤" title="Harflar kolleksiyasi" sub={`${lettersOwned} ta`} />
          <AccountRow href="/student/groups" emoji="👥" title="Mening guruhim" sub={profile.group?.name ?? 'tayinlanmagan'} />
          <AccountRow
            href="/profile/enroll"
            emoji="🪪"
            title={profile.faceEnrolled ? 'Yuz ID — faol' : "Yuz ID ro‘yxat"}
            sub={profile.faceEnrolled ? 'Davomatga ulangan' : "Bir martalik ro‘yxat"}
          />
        </section>

        {/* Logout */}
        <button
          onClick={() => setLogoutOpen(true)}
          className="sp-display w-full flex items-center justify-center gap-2 py-3.5 min-h-[44px]"
          style={{
            background: 'var(--bone)',
            color: 'var(--ember-deep)',
            border: '1.5px solid var(--ember-soft)',
            borderRadius: 'var(--r-3)',
            fontWeight: 700,
          }}
        >
          <LogOut size={16} /> Profildan chiqish
        </button>

        <div
          className="sp-mono text-center text-[11px] pt-2"
          style={{ color: 'var(--ink-4)' }}
        >
          A’lojon{profile.branch?.name ? ` · ${profile.branch.name}` : ''}
        </div>
      </div>

      {/* Edit modal */}
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
              className="px-4 py-2 text-sm font-bold"
              style={{ color: 'var(--ink-3)' }}
            >
              Bekor qilish
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm sp-display flex items-center gap-1.5 disabled:opacity-60"
              style={{
                background: 'var(--leaf)',
                color: 'var(--bone)',
                border: '2px solid var(--leaf-deep)',
                boxShadow: '0 3px 0 var(--leaf-deep)',
                fontWeight: 700,
              }}
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
              className="sp-eyebrow block mb-1.5"
            >
              Ota-ona Telegram ID
            </label>
            <input
              id="parent-tg"
              value={parentTg}
              onChange={(e) => setParentTg(e.target.value)}
              placeholder="@username yoki raqam"
              className="w-full px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--bone-2)',
                border: `1.5px solid ${
                  parentTg && !/^(@[a-zA-Z0-9_]{4,}|\d{5,})$/.test(parentTg.trim())
                    ? 'var(--ember)'
                    : 'var(--line-2)'
                }`,
                borderRadius: 'var(--r-2)',
                color: 'var(--ink)',
              }}
            />
            <p className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>
              Format: @username (4+ harf) yoki raqamli ID (5+ raqam)
            </p>
          </div>
          <div>
            <label htmlFor="birth-date" className="sp-eyebrow block mb-1.5">
              Tugʻilgan sana
            </label>
            <input
              id="birth-date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--bone-2)',
                border: '1.5px solid var(--line-2)',
                borderRadius: 'var(--r-2)',
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Logout modal */}
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
              className="px-4 py-2 text-sm font-bold"
              style={{ color: 'var(--ink-3)' }}
            >
              Bekor qilish
            </button>
            <button
              onClick={confirmLogout}
              className="px-4 py-2 rounded-xl text-sm sp-display flex items-center gap-1.5"
              style={{
                background: 'var(--ember)',
                color: 'var(--bone)',
                border: '2px solid var(--ember-deep)',
                boxShadow: '0 3px 0 var(--ember-deep)',
                fontWeight: 700,
              }}
            >
              <LogOut size={14} /> Chiqish
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          Qayta kirish uchun login va parolingizni kiritishingiz kerak bo&apos;ladi.
        </p>
      </Modal>
    </div>
  );
}

function SettingToggle({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5"
      style={{ borderTop: '1px solid var(--line)' }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span className="flex-1 text-sm" style={{ color: 'var(--ink)', fontWeight: 500 }}>
        {label}
      </span>
      <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
        {value}
      </span>
    </div>
  );
}

function AccountRow({
  href,
  emoji,
  title,
  sub,
  first,
}: {
  href: string;
  emoji: string;
  title: string;
  sub: string;
  first?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5"
      style={{ borderTop: first ? 'none' : '1px solid var(--line)' }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="sp-display text-sm truncate" style={{ color: 'var(--ink)' }}>
          {title}
        </p>
        <p className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
          {sub}
        </p>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--ink-4)' }} />
    </Link>
  );
}
