'use client';
import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton } from '@/components/ui';
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

const LEVEL_COLOR: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-200',
  gold: 'from-yellow-400 to-amber-300',
  diamond: 'from-cyan-400 to-blue-300',
};

export default function StudentCertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Certificate[]>('/gamification/certificates', {}, token)
      .then((r) => setCerts(r.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center">
            <Award size={20} className="text-[#f59e0b]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Oʻquvchi</p>
            <p className="text-white text-lg font-bold">Sertifikatlar</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-3 max-w-lg mx-auto">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" theme="light" />
            ))}
          </div>
        ) : certs.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Award size={28} />}
              title="Hali sertifikat yoʻq"
              description="Darslarni tugatib sertifikat oling"
              theme="light"
            />
          </div>
        ) : (
          certs.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden"
            >
              <div className={`bg-gradient-to-br ${LEVEL_COLOR[cert.level] ?? 'from-violet-500 to-violet-400'} p-5 text-white`}>
                <div className="flex items-center gap-3 mb-2">
                  <Award size={28} />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider opacity-80">
                      Sertifikat
                    </p>
                    <p className="text-2xl font-black">
                      {LEVEL_LABEL[cert.level] ?? cert.level}
                    </p>
                  </div>
                </div>
                <p className="text-sm opacity-90">
                  {cert.lessonsCompleted} ta dars tugatildi
                </p>
                <p className="text-xs opacity-70 mt-1">
                  {formatDateLong(cert.issuedAt)}
                </p>
              </div>
              <div className="p-3">
                <CertificateShare cert={cert} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
