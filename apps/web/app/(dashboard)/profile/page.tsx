'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { User, ScanFace, Send, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getTenantIdFromToken } from '@/lib/jwt';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';

type ProfileData = {
  id: string;
  name: string;
  login: string;
  role: string;
  faceEnrolled: boolean;
  parentTelegramLinked: boolean;
};

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? '';

const ROLE_LABELS: Record<string, string> = {
  student: "O'quvchi",
  mentor: 'Mentor',
  manager: 'Menejer',
  filadmin: 'Filadmin',
  superadmin: 'Superadmin',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    apiRequest<ProfileData>('/users/my-profile')
      .then((r) => setProfile(r.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh profile when user returns to the tab (e.g. after enrolling face ID)
  useFocusRevalidate(load);

  function telegramDeepLink(): string {
    if (!profile || !BOT_USERNAME) return '';
    // tenantId is scoped from the JWT — backend derives it from the token.
    // We read it here only to build the Telegram deep-link for the parent.
    const tenantId = getTenantIdFromToken() ?? '';
    return `https://t.me/${BOT_USERNAME}?start=${tenantId}_${profile.id}`;
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <div className="relative z-10 mt-4">
            <div className="h-5 w-32 bg-white/10 rounded-lg animate-pulse" />
            <div className="flex items-center gap-4 mt-4">
              <div className="w-14 h-14 rounded-full bg-white/10 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-36 bg-white/10 rounded-lg animate-pulse" />
                <div className="h-3 w-24 bg-white/10 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 pt-5 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
              <div className="h-3 w-16 bg-[#f0ece4] rounded-full animate-pulse" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f0ece4] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#f0ece4] rounded-lg animate-pulse w-3/4" />
                  <div className="h-3 bg-[#f0ece4] rounded-lg animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <p className="text-white font-bold text-lg mt-4">Mening Profilim</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] rounded-[18px] p-5 text-sm">
            {error || 'Profil yuklanmadi'}
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm font-semibold text-[#0f172a] bg-white border border-[#ede9e1] px-4 py-2.5 rounded-xl hover:bg-[#f7f4ef] transition-colors focus:outline-none focus:ring-2 focus:ring-[#6d28d9] focus:ring-offset-2"
          >
            <RefreshCw size={14} /> Qaytadan urinish
          </button>
        </div>
      </div>
    );
  }

  const tgLink = telegramDeepLink();

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-4">Mening Profilim</p>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#7c3aed]/20 border-2 border-[#7c3aed]/40 flex items-center justify-center">
              <User size={24} className="text-violet-400" />
            </div>
            <div>
              <p className="text-white text-xl font-bold">{profile.name}</p>
              <p className="text-[#64748b] text-sm">{ROLE_LABELS[profile.role] ?? profile.role} · {profile.login}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Face ID */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-4">Yuz ID</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.faceEnrolled ? 'bg-emerald-50 border border-emerald-100' : 'bg-[#f7f4ef] border border-[#ede9e1]'}`}>
                <ScanFace size={20} className={profile.faceEnrolled ? 'text-emerald-600' : 'text-[#94a3b8]'} />
              </div>
              <div>
                <p className="text-[#0f172a] text-sm font-semibold">
                  {profile.faceEnrolled ? "Ro'yxatdan o'tilgan" : "Ro'yxatdan o'tilmagan"}
                </p>
                <p className="text-[#94a3b8] text-xs">
                  {profile.faceEnrolled ? (
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={10} /> Faol</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[#e11d48]"><XCircle size={10} /> Talab qilinadi</span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href="/profile/enroll"
              className="bg-[#0f172a] hover:bg-[#1e293b] active:bg-[#0a0f1e] text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:ring-offset-2"
            >
              {profile.faceEnrolled ? 'Yangilash' : "Ro'yxat"}
            </Link>
          </div>
        </div>

        {/* Telegram (students only) */}
        {profile.role === 'student' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-4">Ota-ona Telegram</p>
            {profile.parentTelegramLinked ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[#0f172a] text-sm font-semibold">Telegram bog&apos;langan</p>
                  <p className="text-emerald-600 text-xs">Ota-ona bildirishnomalar olmoqda</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                    <Send size={18} className="text-sky-500" />
                  </div>
                  <div>
                    <p className="text-[#0f172a] text-sm font-semibold">Telegram bog&apos;lanmagan</p>
                    <p className="text-[#64748b] text-xs mt-0.5">
                      Ota-onangiz Telegram orqali darslaringizni kuzatishi mumkin.
                    </p>
                  </div>
                </div>
                {tgLink ? (
                  <a
                    href={tgLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
                  >
                    <ExternalLink size={16} /> Telegramga havola yuborish
                  </a>
                ) : (
                  <p className="text-xs text-[#94a3b8]">NEXT_PUBLIC_TELEGRAM_BOT sozlanmagan</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Account info */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-4">Hisob ma&apos;lumotlari</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#64748b] text-sm">Login</span>
              <span className="text-[#0f172a] text-sm font-semibold">{profile.login}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748b] text-sm">Rol</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 rounded-full px-2.5 py-0.5">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
