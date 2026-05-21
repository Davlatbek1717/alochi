'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';

interface TodayStatus {
  canUploadMorning: boolean;
  canUploadEvening: boolean;
  morningStatus: 'submitted' | 'late' | 'missed' | 'pending' | null;
  eveningStatus: 'submitted' | 'late' | 'missed' | 'pending' | null;
  morningCheckinId: string | null;
  eveningCheckinId: string | null;
  morningAt: string | null;
  eveningAt: string | null;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('uz', {
      timeZone: 'Asia/Tashkent',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function todayUz(): string {
  return new Intl.DateTimeFormat('uz-Cyrl-UZ', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'pending') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--paper-2)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>
        Kutilmoqda
      </span>
    );
  }
  if (status === 'submitted') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--leaf-tint)', color: 'var(--leaf-deep)', border: '1px solid var(--leaf-soft)' }}>
        <CheckCircle size={11} /> Topshirildi
      </span>
    );
  }
  if (status === 'late') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--gold-tint)', color: 'var(--gold-deep)', border: '1px solid var(--gold-soft)' }}>
        <Clock size={11} /> Kech topshirildi
      </span>
    );
  }
  if (status === 'missed') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--ember-tint)', color: 'var(--ember-deep)', border: '1px solid var(--ember-soft)' }}>
        <XCircle size={11} /> O'tkazib yuborildi
      </span>
    );
  }
  return null;
}

interface VideoCardProps {
  label: string;
  window: string;
  status: string | null;
  submittedAt: string | null;
  checkinId: string | null;
  canUpload: boolean;
  onUploadDone: () => void;
}

function VideoCard({ label, window: windowStr, status, submittedAt, checkinId, canUpload, onUploadDone }: VideoCardProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const isDone = status === 'submitted' || status === 'late';

  async function handleFile(file: File) {
    if (!file.type.startsWith('video/')) {
      toast.error('Faqat video fayl tanlang');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error('Video hajmi 200 MB dan oshmasin');
      return;
    }

    setUploading(true);
    setProgress(0);

    const token = localStorage.getItem('accessToken') ?? '';
    const form = new FormData();
    form.append('video', file);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            try {
              const body = JSON.parse(xhr.responseText) as { message?: string };
              reject(new Error(body.message ?? `Xatolik ${xhr.status}`));
            } catch {
              reject(new Error(`Xatolik ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Tarmoq xatosi'));
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        xhr.open('POST', `${apiBase}/video-checkins/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(form);
      });
      toast.success(`${label} video muvaffaqiyatli yuklandi`);
      onUploadDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yuklashda xatolik');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function loadVideo() {
    if (!checkinId) return;
    setPlaying(true);
    const token = localStorage.getItem('accessToken') ?? '';
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    setVideoUrl(`${apiBase}/video-checkins/${checkinId}/video?t=${Date.now()}&token=${encodeURIComponent(token)}`);
  }

  return (
    <div
      className="p-4 space-y-3"
      style={{
        background: 'var(--bone)',
        border: `1.5px solid ${isDone ? 'var(--leaf-soft)' : status === 'missed' ? 'var(--ember-soft)' : 'var(--line)'}`,
        borderRadius: 'var(--r-3)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="sp-display text-base" style={{ color: 'var(--ink)' }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{windowStr}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {isDone && submittedAt && (
        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
          Yuborildi: {fmtTime(submittedAt)}
        </p>
      )}

      {/* Video playback */}
      {isDone && checkinId && (
        <div className="space-y-2">
          {playing && videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full rounded-xl"
              style={{ maxHeight: 320, background: '#000' }}
            />
          ) : (
            <button
              type="button"
              onClick={loadVideo}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm sp-display"
              style={{
                background: 'var(--bone-2)',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-2)',
                color: 'var(--ink)',
              }}
            >
              <Play size={14} /> Videoni ko&apos;rish
            </button>
          )}
        </div>
      )}

      {/* Upload section */}
      {canUpload && !isDone && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 sp-display min-h-[48px] disabled:opacity-60"
            style={{
              background: uploading ? 'var(--bone-2)' : 'var(--leaf)',
              color: uploading ? 'var(--ink)' : 'var(--bone)',
              border: `2px solid ${uploading ? 'var(--line)' : 'var(--leaf-deep)'}`,
              borderRadius: 'var(--r-2)',
              boxShadow: uploading ? 'none' : '0 3px 0 var(--leaf-deep)',
              fontWeight: 700,
            }}
          >
            <Upload size={15} />
            {uploading ? `Yuklanmoqda... ${progress}%` : `${label} video yuklash`}
          </button>
          {uploading && (
            <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--line)' }}>
              <div
                className="h-full transition-all"
                style={{ width: `${progress}%`, background: 'var(--leaf)' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Not in window and not uploaded */}
      {!canUpload && !isDone && status !== 'missed' && (
        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
          {label === 'Ertalabki' ? '05:00–06:30 da yuklash mumkin (kech: 18:00 gacha)' : '18:00–22:00 da yuklash mumkin (kech: 24:00 gacha)'}
        </p>
      )}
    </div>
  );
}

export default function StudentCheckinPage() {
  const toast = useToast();
  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    apiRequest<TodayStatus>('/video-checkins/my-today', {}, token)
      .then((r) => setStatus(r.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="sp-theme min-h-full pb-24">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto md:max-w-3xl">
        <Link
          href="/student/profile"
          aria-label="Orqaga"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
            Kunlik video
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{todayUz()}</p>
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto md:max-w-3xl space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          Har kuni ikki marta video yuboring: <strong style={{ color: 'var(--ink-2)' }}>ertalab 05:00–06:30</strong> va{' '}
          <strong style={{ color: 'var(--ink-2)' }}>kechki 18:00–22:00</strong>. Oynadan keyin ham kech qolish imkoni bor.
        </p>

        {loading ? (
          <>
            <div className="sp-skeleton h-36 w-full" style={{ borderRadius: 'var(--r-3)' }} />
            <div className="sp-skeleton h-36 w-full" style={{ borderRadius: 'var(--r-3)' }} />
          </>
        ) : status ? (
          <>
            <VideoCard
              label="Ertalabki"
              window="05:00 – 06:30 (kech: 18:00 gacha)"
              status={status.morningStatus}
              submittedAt={status.morningAt}
              checkinId={status.morningCheckinId}
              canUpload={status.canUploadMorning}
              onUploadDone={load}
            />
            <VideoCard
              label="Kechki"
              window="18:00 – 22:00 (kech: 24:00 gacha)"
              status={status.eveningStatus}
              submittedAt={status.eveningAt}
              checkinId={status.eveningCheckinId}
              canUpload={status.canUploadEvening}
              onUploadDone={load}
            />
          </>
        ) : null}

        <p className="text-[11px] text-center" style={{ color: 'var(--ink-4)' }}>
          Video 2 kun saqlanadi, keyin avtomatik o'chiriladi
        </p>
      </div>
    </div>
  );
}
