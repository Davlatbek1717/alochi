'use client';
import { useCallback, useEffect, useState } from 'react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { Award, Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';
import CertificateShare from '@/components/CertificateShare';
import { formatDateLong } from '@/lib/date-uz';

type Certificate = {
  id: string;
  level: string;
  lessonsCompleted: number;
  qrCode?: string;
  issuedAt: string;
};

type Milestone = {
  level: string;
  label: string;
  emoji: string;
  minLessons: number;
  completed: boolean;
  earned: boolean;
  progress: number;
};

type CertProgress = {
  completedLessons: number;
  milestones: Milestone[];
  next: { level: string; label: string; emoji: string; minLessons: number; remaining: number } | null;
};

const LEVEL_GRADIENT: Record<string, string> = {
  bronze:  'from-[#a16207] via-[#d97706] to-[#78350f]',
  silver:  'from-[#cbd5e1] via-[#94a3b8] to-[#475569]',
  gold:    'from-[#fde68a] via-[#fbbf24] to-[#d97706]',
  diamond: 'from-[#67e8f9] via-[#22d3ee] to-[#155e75]',
};

const LEVEL_BG: Record<string, string> = {
  bronze:  'bg-[#a16207]/10 border-[#a16207]/30',
  silver:  'bg-[#94a3b8]/10 border-[#94a3b8]/30',
  gold:    'bg-[#fbbf24]/10 border-[#fbbf24]/30',
  diamond: 'bg-[#22d3ee]/10 border-[#22d3ee]/30',
};

const PROGRESS_COLOR: Record<string, string> = {
  bronze:  'bg-[#d97706]',
  silver:  'bg-[#94a3b8]',
  gold:    'bg-[#fbbf24]',
  diamond: 'bg-[#22d3ee]',
};

export default function StudentCertificatesPage() {
  const [certs, setCerts]       = useState<Certificate[]>([]);
  const [progress, setProgress] = useState<CertProgress | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Certificate[]>('/gamification/certificates', {}, token),
      apiRequest<CertProgress>('/gamification/certificate-progress', {}, token),
    ])
      .then(([certsRes, progressRes]) => {
        setCerts(certsRes.data ?? []);
        setProgress(progressRes.data ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh certificates and progress when the user returns to this tab so
  // newly awarded certificates appear without a full page reload.
  useFocusRevalidate(load);

  return (
    <div className="min-h-full bg-[#fffaf0] pb-8">
      <header className="sticky top-0 z-10 bg-[#fffaf0]/90 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl flex items-center gap-3">
          <Award size={20} className="text-[#fbbf24]" />
          <h1 className="text-[#0f172a] text-lg font-extrabold">Sertifikatlar</h1>
        </div>
      </header>

      <div className="px-4 md:px-6 pt-5 pb-6 space-y-5 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-36 rounded-2xl" theme="light" />
            <Skeleton className="h-48 rounded-2xl" theme="light" />
          </div>
        ) : (
          <>
            {/* ── Keyingi sertifikat progress ─────────────────────────── */}
            {progress && (
              <section className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-widest">
                    Yo&apos;l xaritasi
                  </h2>
                  <span className="text-xs font-bold text-[#64748b]">
                    {progress.completedLessons} dars tugatildi
                  </span>
                </div>

                {/* Keyingi sertifikat highlight */}
                {progress.next && (
                  <div className="bg-[#fffaf0] rounded-xl border border-[#ede9e1] px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl">{progress.next.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-[#0f172a]">
                        {progress.next.label}
                      </p>
                      <p className="text-xs text-[#64748b] font-semibold">
                        Yana{' '}
                        <span className="text-[#6d28d9] font-extrabold">
                          {progress.next.remaining} ta dars
                        </span>{' '}
                        kerak (jami {progress.next.minLessons} ta)
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
                  </div>
                )}

                {progress.next === null && (
                  <div className="bg-[#fffaf0] rounded-xl border border-[#ede9e1] px-4 py-3 text-center">
                    <p className="text-sm font-extrabold text-[#10b981]">
                      💎 Barcha sertifikatlar olindi! Ajoyib!
                    </p>
                  </div>
                )}

                {/* Milestone list */}
                <div className="space-y-3">
                  {progress.milestones.map((m) => (
                    <div key={m.level} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {m.earned ? (
                            <CheckCircle2 size={16} className="text-[#10b981] shrink-0" />
                          ) : m.completed ? (
                            <CheckCircle2 size={16} className="text-[#10b981]/50 shrink-0" />
                          ) : (
                            <Lock size={14} className="text-[#94a3b8] shrink-0" />
                          )}
                          <span className="text-sm font-extrabold text-[#0f172a]">
                            {m.emoji} {m.label}
                          </span>
                          {m.earned && (
                            <span className="text-[10px] font-extrabold text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded-full">
                              OLINDI
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-[#64748b]">
                          {Math.min(progress.completedLessons, m.minLessons)}/{m.minLessons}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f3eedf] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            m.earned
                              ? PROGRESS_COLOR[m.level] ?? 'bg-[#10b981]'
                              : 'bg-[#10b981]'
                          }`}
                          style={{ width: `${Math.round(m.progress * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Olingan sertifikatlar ────────────────────────────────── */}
            {certs.length > 0 && (
              <section>
                <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-widest mb-3">
                  Mening sertifikatlarim
                </h2>
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
                              {progress?.milestones.find(m => m.level === cert.level)?.label ?? cert.level}
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
              </section>
            )}

            {/* ── Hali sertifikat yo'q ─────────────────────────────────── */}
            {certs.length === 0 && progress && (
              <div className={`rounded-[20px] border-[1.5px] p-5 text-center ${
                progress.next
                  ? LEVEL_BG[progress.next.level] ?? 'bg-white border-[#ede9e1]'
                  : 'bg-white border-[#ede9e1]'
              }`}>
                <p className="text-3xl mb-2">{progress.next?.emoji ?? '🏆'}</p>
                <p className="text-[#0f172a] font-bold">
                  Birinchi sertifikatga{' '}
                  <span className="text-[#6d28d9]">
                    {progress.next?.remaining ?? 0} ta dars
                  </span>{' '}
                  qoldi!
                </p>
                <p className="text-[#64748b] text-sm mt-1 font-semibold">
                  {progress.next?.label} — {progress.next?.minLessons} ta dars
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
