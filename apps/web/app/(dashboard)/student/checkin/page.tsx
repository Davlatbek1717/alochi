'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Camera,
  Video,
  Square,
  RotateCcw,
  Send,
} from 'lucide-react';
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
        <XCircle size={11} /> O&apos;tkazib yuborildi
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

/** Max in-app recording length (seconds). */
const MAX_REC_SEC = 90;

/** Pick the best MediaRecorder container the browser supports. */
function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return '';
}

type RecPhase = 'idle' | 'live' | 'recording' | 'recorded';

function VideoCard({ label, window: windowStr, status, submittedAt, checkinId, canUpload, onUploadDone }: VideoCardProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // In-app camera recording state
  const [recPhase, setRecPhase] = useState<RecPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [camError, setCamError] = useState('');
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDone = status === 'submitted' || status === 'late';

  // Bind the live camera stream to the preview element whenever it's shown.
  useEffect(() => {
    if ((recPhase === 'live' || recPhase === 'recording') && previewRef.current && streamRef.current) {
      previewRef.current.srcObject = streamRef.current;
      previewRef.current.play().catch(() => {});
    }
  }, [recPhase]);

  // Auto-stop at the max length.
  useEffect(() => {
    if (recPhase === 'recording' && elapsed >= MAX_REC_SEC) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, recPhase]);

  // Release the camera + timers when the card unmounts.
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function openCamera() {
    setCamError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Bu qurilmada kamera mavjud emas yoki ruxsat berilmagan.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      setRecPhase('live');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setCamError(
        name === 'NotAllowedError'
          ? "Kameraga ruxsat berilmadi. Sozlamalardan ruxsat bering."
          : name === 'NotFoundError'
            ? 'Kamera topilmadi.'
            : "Kamerani ochib bo'lmadi.",
      );
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = pickRecorderMime();
    // Cap bitrate so a 90s clip stays well under the upload limit and uploads
    // fast on tablet data: ~1.5 Mbps video + 64 kbps audio ≈ 12-18 MB.
    const opts: MediaRecorderOptions = {
      videoBitsPerSecond: 1_500_000,
      audioBitsPerSecond: 64_000,
    };
    if (mime) opts.mimeType = mime;
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, opts);
    } catch {
      rec = new MediaRecorder(stream);
    }
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      recordedBlobRef.current = blob;
      setRecordedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setRecPhase('recorded');
    };
    recorderRef.current = rec;
    rec.start();
    setRecPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stopRecording() {
    stopTimer();
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

  function retake() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    recordedBlobRef.current = null;
    setElapsed(0);
    setRecPhase('live'); // camera stays open
  }

  function cancelCamera() {
    stopTimer();
    stopStream();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    recordedBlobRef.current = null;
    setElapsed(0);
    setRecPhase('idle');
  }

  async function submitRecording() {
    const blob = recordedBlobRef.current;
    if (!blob) return;
    const mime = blob.type || 'video/webm';
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `${label}-${Date.now()}.${ext}`, { type: mime });

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
      cancelCamera();
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

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

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

      {/* Video playback for an already-submitted clip */}
      {isDone && checkinId && (
        <div className="space-y-2">
          {playing && videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
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

      {/* In-app camera recorder */}
      {canUpload && !isDone && (
        <div className="space-y-2">
          {camError && (
            <p className="text-xs" style={{ color: 'var(--ember-deep)' }}>{camError}</p>
          )}

          {recPhase === 'idle' && (
            <button
              type="button"
              onClick={openCamera}
              className="w-full flex items-center justify-center gap-2 py-3 sp-display min-h-[48px]"
              style={{
                background: 'var(--leaf)',
                color: 'var(--bone)',
                border: '2px solid var(--leaf-deep)',
                borderRadius: 'var(--r-2)',
                boxShadow: '0 3px 0 var(--leaf-deep)',
                fontWeight: 700,
              }}
            >
              <Camera size={16} /> {label} video yozib olish
            </button>
          )}

          {(recPhase === 'live' || recPhase === 'recording') && (
            <div className="space-y-2">
              <div className="relative">
                <video
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full rounded-xl"
                  style={{ maxHeight: 360, background: '#000', transform: 'scaleX(-1)' }}
                />
                {recPhase === 'recording' && (
                  <div
                    className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.55)' }}
                  >
                    <span className="w-2 h-2 rounded-full motion-safe:animate-pulse" style={{ background: '#ef4444' }} />
                    <span className="text-xs sp-mono" style={{ color: '#fff' }}>{mm}:{ss}</span>
                  </div>
                )}
              </div>

              {recPhase === 'live' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex-1 flex items-center justify-center gap-2 py-3 sp-display min-h-[48px]"
                    style={{
                      background: 'var(--ember)',
                      color: 'var(--bone)',
                      border: '2px solid var(--ember-deep)',
                      borderRadius: 'var(--r-2)',
                      boxShadow: '0 3px 0 var(--ember-deep)',
                      fontWeight: 700,
                    }}
                  >
                    <Video size={16} /> Yozishni boshlash
                  </button>
                  <button
                    type="button"
                    onClick={cancelCamera}
                    className="px-4 py-3 sp-display min-h-[48px]"
                    style={{ background: 'var(--bone-2)', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-2)' }}
                  >
                    Bekor
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-full flex items-center justify-center gap-2 py-3 sp-display min-h-[48px]"
                  style={{ background: 'var(--ink)', color: 'var(--bone)', border: '2px solid var(--ink)', borderRadius: 'var(--r-2)', fontWeight: 700 }}
                >
                  <Square size={14} /> To&apos;xtatish ({mm}:{ss})
                </button>
              )}
            </div>
          )}

          {recPhase === 'recorded' && (
            <div className="space-y-2">
              {recordedUrl && (
                <video
                  src={recordedUrl}
                  controls
                  playsInline
                  className="w-full rounded-xl"
                  style={{ maxHeight: 360, background: '#000' }}
                />
              )}
              {uploading ? (
                <div className="space-y-1">
                  <div
                    className="w-full flex items-center justify-center gap-2 py-3 sp-display min-h-[48px]"
                    style={{ background: 'var(--bone-2)', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-2)' }}
                  >
                    Yuklanmoqda... {progress}%
                  </div>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--line)' }}>
                    <div className="h-full transition-all" style={{ width: `${progress}%`, background: 'var(--leaf)' }} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={retake}
                    className="px-4 py-3 sp-display min-h-[48px] flex items-center gap-1.5"
                    style={{ background: 'var(--bone-2)', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-2)' }}
                  >
                    <RotateCcw size={15} /> Qayta
                  </button>
                  <button
                    type="button"
                    onClick={submitRecording}
                    className="flex-1 flex items-center justify-center gap-2 py-3 sp-display min-h-[48px]"
                    style={{
                      background: 'var(--leaf)',
                      color: 'var(--bone)',
                      border: '2px solid var(--leaf-deep)',
                      borderRadius: 'var(--r-2)',
                      boxShadow: '0 3px 0 var(--leaf-deep)',
                      fontWeight: 700,
                    }}
                  >
                    <Send size={15} /> Yuborish
                  </button>
                </div>
              )}
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
          Har kuni ikki marta video yozib yuboring: <strong style={{ color: 'var(--ink-2)' }}>ertalab 05:00–06:30</strong> va{' '}
          <strong style={{ color: 'var(--ink-2)' }}>kechki 18:00–22:00</strong>. Video shu yerda, kamera orqali yoziladi.
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
          Video 2 kun saqlanadi, keyin avtomatik o&apos;chiriladi
        </p>
      </div>
    </div>
  );
}
