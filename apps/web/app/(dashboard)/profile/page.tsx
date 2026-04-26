'use client';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import Link from 'next/link';

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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Mening Profilim</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2 mb-2" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Mening Profilim</h1>
        <div className="bg-red-50 text-red-700 rounded-xl p-5 text-sm">{error || 'Xato'}</div>
      </div>
    );
  }

  const tgLink = telegramDeepLink();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mening Profilim</h1>

      {/* Basic info */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">{profile.name}</p>
            <p className="text-sm text-gray-500 capitalize">{profile.role} • {profile.login}</p>
          </div>
        </div>
      </div>

      {/* Face enrollment */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-gray-800">Yuz ID</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {profile.faceEnrolled ? "✅ Ro'yxatdan o'tilgan" : "❌ Ro'yxatdan o'tilmagan"}
          </span>
          <Link
            href="/profile/enroll"
            className="text-indigo-600 text-sm font-medium hover:underline"
          >
            {profile.faceEnrolled ? 'Yangilash' : "Ro'yxatdan o'tish →"}
          </Link>
        </div>
      </div>

      {/* Telegram parent link (students only) */}
      {profile.role === 'student' && (
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-800">Ota-ona Telegram</h2>
          {profile.parentTelegramLinked ? (
            <p className="text-sm text-green-600">✅ Telegram bog&apos;langan</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Ota-onangiz Telegram orqali sizning darslaringizni kuzatishi mumkin.
              </p>
              {tgLink ? (
                <a
                  href={tgLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  📲 Telegramga havola yuborish
                </a>
              ) : (
                <p className="text-xs text-gray-400">NEXT_PUBLIC_TELEGRAM_BOT sozlanmagan</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
