'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { User, ScanFace, Send, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type ProfileData = {
  id: string;
  name: string;
  login: string;
  role: string;
  tenantId: string;
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

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ProfileData>('/users/my-profile', {}, token)
      .then((r) => setProfile(r.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, []);

  function telegramDeepLink(): string {
    if (!profile || !BOT_USERNAME) return '';
    return `https://t.me/${BOT_USERNAME}?start=${profile.tenantId}:${profile.id}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <div className="relative z-10 mt-4">
            <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-4 pt-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 animate-pulse">
              <div className="h-4 bg-[#f7f4ef] rounded w-1/2 mb-2" />
              <div className="h-3 bg-[#f7f4ef] rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <p className="text-white font-bold text-lg mt-4">Mening Profilim</p>
        </div>
        <div className="p-4">
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] rounded-[18px] p-5 text-sm">{error || 'Xato'}</div>
        </div>
      </div>
    );
  }

  const tgLink = telegramDeepLink();

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
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
              className="bg-[#0f172a] text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#1e293b] transition-colors"
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
                    className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors"
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
      </div>
    </div>
  );
}
