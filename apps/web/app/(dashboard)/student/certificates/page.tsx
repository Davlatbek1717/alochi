'use client';
import { useEffect, useState } from 'react';
import { Award, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton } from '@/components/ui';
import CertificateShare from '@/components/CertificateShare';
import { formatDateLong } from '@/lib/date-uz';

type Certificate = {
  id: string;
  level: string;
  lessonsCompleted: number;
  qrCode?: string;
  issuedAt: string;
};

const LEVEL_LABEL: Record<string, string> = {
  bronze: 'Bronza',
  silver: 'Kumush',
  gold: 'Oltin',
  diamond: 'Olmos',
};

const LEVEL_GRADIENT: Record<string, string> = {
  bronze: 'from-[#a16207] via-[#d97706] to-[#78350f]',
  silver: 'from-[#cbd5e1] via-[#94a3b8] to-[#475569]',
  gold: 'from-[#fde68a] via-[#fbbf24] to-[#d97706]',
  diamond: 'from-[#67e8f9] via-[#22d3ee] to-[#155e75]',
};

export default function StudentCertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Certificate[]>('/gamification/certificates', {}, token)
      .then((r) => setCerts(r.data ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#fffaf0] pb-8">
      <header className="sticky top-0 z-10 bg-[#fffaf0]/90 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl flex items-center gap-3">
          <Award size={20} className="text-[#fbbf24]" />
          <h1 className="text-[#0f172a] text-lg font-extrabold">Sertifikatlar</h1>
        </div>
      </header>

      <div className="px-4 md:px-6 pt-5 pb-6 space-y-3 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" theme="light" />
            ))}
          </div>
        ) : certs.length === 0 ? (
          <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-3">
            <Mascot expression="idle" size={120} className="mx-auto" />
            <div>
              <p className="text-[#0f172a] font-bold text-lg">
                Birinchi sertifikatingizni yutib oling!
              </p>
              <p className="text-[#64748b] text-sm mt-1">
                Darslarni tugatib bronza, kumush, oltin yoki olmos sertifikatga
                erishing.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {certs.map((cert) => (
            <article
              key={cert.id}
              className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] overflow-hidden hover:scale-[1.02] transition-transform shadow-sm"
            >
              <div
                className={`relative bg-gradient-to-br ${
                  LEVEL_GRADIENT[cert.level] ?? 'from-[#ce82ff] to-[#7c3aed]'
                } p-5 text-white overflow-hidden`}
              >
                {/* Sparkle accent */}
                <Sparkles
                  size={18}
                  className="absolute top-3 right-3 text-white/70"
                />
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
                <div className="relative z-10 flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
                    <Award size={26} />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">
                      Sertifikat
                    </p>
                    <p className="text-2xl font-extrabold leading-tight">
                      {LEVEL_LABEL[cert.level] ?? cert.level}
                    </p>
                  </div>
                </div>
                <p className="relative z-10 text-sm font-semibold opacity-95">
                  {cert.lessonsCompleted} ta dars tugatildi
                </p>
                <p className="relative z-10 text-xs opacity-80 mt-1">
                  {formatDateLong(cert.issuedAt)}
                </p>
              </div>
              <div className="p-3">
                <CertificateShare cert={cert} />
              </div>
            </article>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
