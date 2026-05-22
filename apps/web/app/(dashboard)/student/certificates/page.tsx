'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { apiRequest } from '@/lib/api';
import CertificateShare from '@/components/CertificateShare';
import { formatDateLong } from '@/lib/date-uz';
import { Ustoz, Suzani } from '@/components/Ustoz';

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

export default function StudentCertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [progress, setProgress] = useState<CertProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useFocusRevalidate(load);
  useRevalidateOnEvent(['cert:earned'], load);

  return (
    <div className="sp-theme min-h-full pb-24">
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
          borderBottom: '1.5px solid var(--line)',
        }}
      >
        <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-3 pb-2.5 flex items-center gap-3">
          <Link
            href="/student"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="sp-eyebrow">yutuqlar</div>
            <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
              Sertifikatlar
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-4 space-y-4">
        {error && (
          <div
            className="px-4 py-3 text-sm"
            style={{
              background: 'var(--ember-tint)',
              border: '1.5px solid var(--ember-soft)',
              color: 'var(--ember-deep)',
              borderRadius: 'var(--r-3)',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="sp-skeleton h-28" style={{ borderRadius: 'var(--r-3)' }} />
              ))}
            </div>
            <div className="sp-skeleton h-64 w-full" style={{ borderRadius: 'var(--r-4)' }} />
          </div>
        ) : (
          <>
            {/* Tier grid */}
            {progress && (
              <div className="grid grid-cols-2 gap-2.5">
                {progress.milestones.map((m) => {
                  const state = m.earned ? 'done' : m.completed ? 'done' : progress.next?.level === m.level ? 'current' : 'lock';
                  return (
                    <div
                      key={m.level}
                      className="relative p-3 flex flex-col items-center gap-1.5"
                      style={{
                        background: state === 'current' ? 'var(--bone-2)' : 'var(--bone)',
                        border: '1.5px solid var(--line)',
                        borderRadius: 'var(--r-3)',
                        boxShadow: 'var(--shadow-1)',
                        opacity: state === 'lock' ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: 36 }}>{m.emoji}</span>
                      <div className="sp-display text-sm" style={{ color: 'var(--ink)' }}>
                        {m.label}
                      </div>
                      <div className="sp-eyebrow" style={{ fontSize: 9 }}>
                        {m.earned
                          ? '✓ olingan'
                          : state === 'current'
                            ? '↗ joriy'
                            : m.completed
                              ? '✓ tugatildi'
                              : '🔒 qulflangan'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Next certificate highlight */}
            {progress?.next && (
              <div
                className="flex items-center gap-3 p-4"
                style={{
                  background: 'var(--gold-tint)',
                  border: '1.5px solid var(--gold-soft)',
                  borderRadius: 'var(--r-3)',
                }}
              >
                <span style={{ fontSize: 28 }}>{progress.next.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="sp-display text-sm" style={{ color: 'var(--ink)' }}>
                    {progress.next.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ink-2)' }}>
                    Yana{' '}
                    <span className="sp-display" style={{ color: 'var(--ember-deep)' }}>
                      {progress.next.remaining} ta dars
                    </span>{' '}
                    kerak (jami {progress.next.minLessons} ta)
                  </p>
                </div>
              </div>
            )}
            {progress && progress.next === null && (
              <div
                className="px-4 py-3 text-center"
                style={{
                  background: 'var(--leaf-tint)',
                  border: '1.5px solid var(--leaf-soft)',
                  borderRadius: 'var(--r-3)',
                }}
              >
                <p className="sp-display text-sm" style={{ color: 'var(--leaf-deep)' }}>
                  💎 Barcha sertifikatlar olindi! Ajoyib!
                </p>
              </div>
            )}

            {/* Earned certificates */}
            {certs.length > 0 && (
              <div className="space-y-3">
                <p
                  className="sp-display text-sm uppercase px-1"
                  style={{ letterSpacing: '0.06em', color: 'var(--ink-3)' }}
                >
                  Mening sertifikatlarim
                </p>
                {certs.map((cert) => {
                  const label =
                    progress?.milestones.find((m) => m.level === cert.level)?.label ?? cert.level;
                  return (
                    <div
                      key={cert.id}
                      className="relative overflow-hidden p-5"
                      style={{
                        background: 'linear-gradient(135deg, var(--bone) 0%, var(--gold-soft) 100%)',
                        border: '3px double var(--ink-2)',
                        borderRadius: 'var(--r-4)',
                        boxShadow:
                          'inset 0 0 0 8px var(--bone-2), inset 0 0 0 9px var(--gold-deep), 0 6px 0 var(--ink-2)',
                      }}
                    >
                      <div className="absolute top-3 left-3 opacity-40" aria-hidden>
                        <Suzani size={44} color="var(--ember)" />
                      </div>
                      <div className="absolute top-3 right-3 opacity-40" aria-hidden>
                        <Suzani size={44} color="var(--ember)" />
                      </div>
                      <div className="absolute bottom-3 left-3 opacity-40" aria-hidden>
                        <Suzani size={44} color="var(--ember)" />
                      </div>
                      <div className="absolute bottom-3 right-3 opacity-40" aria-hidden>
                        <Suzani size={44} color="var(--ember)" />
                      </div>
                      <div className="relative text-center py-4">
                        <div className="sp-eyebrow" style={{ color: 'var(--ink-2)' }}>
                          · A’LOJON ·
                        </div>
                        <div
                          className="sp-display text-xs mt-1 mb-3"
                          style={{ color: 'var(--ink-2)', letterSpacing: '0.1em' }}
                        >
                          SERTIFIKAT
                        </div>
                        <div
                          className="sp-display text-xl"
                          style={{ color: 'var(--gold-deep)' }}
                        >
                          {label}
                        </div>
                        <div
                          className="mx-auto my-3"
                          style={{ height: 1, maxWidth: 120, background: 'var(--ink-3)', opacity: 0.4 }}
                        />
                        <div className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
                          {cert.lessonsCompleted} ta dars tugatildi
                        </div>
                        <div className="sp-mono text-[10px] mt-3" style={{ color: 'var(--ink-3)' }}>
                          {formatDateLong(cert.issuedAt)} · #{cert.id.slice(0, 8)}
                        </div>
                      </div>
                      <div className="relative mt-2">
                        <CertificateShare cert={cert} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No certificate yet */}
            {certs.length === 0 && progress && (
              <div
                className="p-8 text-center"
                style={{
                  background: 'var(--bone)',
                  border: '1.5px solid var(--line)',
                  borderRadius: 'var(--r-4)',
                }}
              >
                <Ustoz size={120} mood="study" className="mx-auto" />
                <p className="sp-display mt-3" style={{ color: 'var(--ink)' }}>
                  Birinchi sertifikatga{' '}
                  <span style={{ color: 'var(--ember-deep)' }}>
                    {progress.next?.remaining ?? 0} ta dars
                  </span>{' '}
                  qoldi!
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
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
