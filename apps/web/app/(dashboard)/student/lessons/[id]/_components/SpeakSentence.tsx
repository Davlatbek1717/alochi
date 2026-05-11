'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
  Square,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { getTtsAudio } from '@/lib/exercises';
import {
  getSpeechCapabilities,
  listen,
  similarityScore,
  speak,
  stopSpeaking,
} from '@/lib/speech';
import { XpFloater } from './XpFloater';
import { Waveform } from './Waveform';
import { ExplainPanel } from './ExplainPanel';
import type { SpeakSentenceConfig } from './exercise-types';

interface SpeakSentenceProps {
  config: SpeakSentenceConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type Phase = 'idle' | 'recording' | 'uploading' | 'passed' | 'failed';
type AudioState = 'idle' | 'loading' | 'playing' | 'error';
type ScoreResult = { score?: number; error?: string };

/** Convert a Blob to a base64 string (no data: prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Audio o‘qib bo‘lmadi'));
        return;
      }
      // result is `data:<mime>;base64,<payload>` — strip the prefix.
      const idx = result.indexOf(',');
      resolve(idx === -1 ? result : result.slice(idx + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader xatosi'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Pass 4 (I) — Speak the sentence (pronunciation scoring):
 *   - Big sentence display + small play button (TTS sample of the target).
 *   - 96×96 circular record button at the bottom (mic / stop). Uses
 *     MediaRecorder + MediaStream the same way VocabularyAudio.tsx does;
 *     re-uses the existing 5-bar Waveform driven by an AnalyserNode RMS.
 *   - On stop → upload base64 to /ai/speech/assess (existing endpoint shared
 *     with single-word vocab). The endpoint expects `{ wordEn, audioBase64 }`,
 *     and for full sentences we send the whole sentence as wordEn.
 *   - Score reveal as a 0-100 SVG dial with red (<50) / yellow (50-79) /
 *     green (80+) zones. Auto-advance when score >= minScore (default 70).
 *   - Graceful fallbacks:
 *       - No mic permission → permission banner with retry + "Skip" button
 *         that calls onPassed (so a denied mic doesn't softlock the lesson).
 *       - /ai/speech/assess fails or returns no score → soft-pass with a
 *         neutral banner + onPassed; the lesson keeps moving.
 *   - Defensive: empty config.sentence → SkipPanel.
 */
export function SpeakSentence({ config, onPassed, onFailed }: SpeakSentenceProps) {
  const sentence = (config?.sentence ?? '').trim();
  const minScore = typeof config?.minScore === 'number' ? config.minScore : 70;
  const malformed = !sentence;

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState<number | null>(null);
  const [permError, setPermError] = useState('');
  const [softFallback, setSoftFallback] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);

  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioErrorVisible, setAudioErrorVisible] = useState(false);

  // Browser-STT live caption (interim transcript). Empty string when not
  // listening or when the recognizer hasn't produced an interim yet.
  const [interimTranscript, setInterimTranscript] = useState('');
  // Capabilities are computed once on mount so SSR doesn't see different
  // values than the first client render. Hidden behind a state setter to
  // avoid hydration mismatch warnings.
  const [sttAvailable, setSttAvailable] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const listenHandleRef = useRef<{ stop: () => void } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setSttAvailable(getSpeechCapabilities().stt);
    return () => {
      mountedRef.current = false;
      stopSpeaking();
      // Tear down the TTS playback element.
      const a = audioElementRef.current;
      if (a) {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
        a.onplay = null;
        a.onended = null;
        a.onerror = null;
        audioElementRef.current = null;
      }
      // Stop browser STT if it's still running (covers nav-away mid-listen).
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      // Stop any active mic tracks so the indicator goes away promptly.
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      stream?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    };
    // We intentionally don't include `stream` so this only runs on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (malformed) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <AlertTriangle size={28} className="text-[#fbbf24] mx-auto" />
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Bu mashq sozlanmagan
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Ovoz mashqida jumla yo&apos;q.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  async function playTts() {
    if (audioState === 'loading') return;
    // Browser TTS first — instant, free, offline-capable.
    if (getSpeechCapabilities().tts) {
      setAudioState('playing');
      try {
        await speak(sentence, { lang: 'en-US', rate: 0.9 });
        if (mountedRef.current) setAudioState('idle');
        return;
      } catch {
        if (mountedRef.current) setAudioState('idle');
      }
    }
    if (audioElementRef.current) {
      try {
        audioElementRef.current.currentTime = 0;
        await audioElementRef.current.play();
      } catch {
        /* ignore */
      }
      return;
    }
    setAudioState('loading');
    const token =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('accessToken') ?? '')
        : '';
    try {
      const res = await getTtsAudio(sentence, 'en', token);
      if (!res?.audioBase64) {
        if (mountedRef.current) {
          setAudioState('error');
          setAudioErrorVisible(true);
        }
        return;
      }
      const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audio.onplay = () => {
        if (mountedRef.current) setAudioState('playing');
      };
      audio.onended = () => {
        if (mountedRef.current) setAudioState('idle');
      };
      audio.onerror = () => {
        if (mountedRef.current) {
          setAudioState('error');
          setAudioErrorVisible(true);
        }
      };
      audioElementRef.current = audio;
      await audio.play();
    } catch {
      if (mountedRef.current) {
        setAudioState('error');
        setAudioErrorVisible(true);
      }
    }
  }

  /**
   * Browser-STT path. Replaces the MediaRecorder + /ai/speech/assess
   * round-trip when SpeechRecognition is available — no upload, no Azure
   * key, near-zero latency. We use Levenshtein similarity vs the canonical
   * sentence for the pass/fail decision (kid-friendly, forgives accent).
   */
  function startListening() {
    setPermError('');
    setScore(null);
    setSoftFallback(false);
    setInterimTranscript('');

    // Stop any TTS that's still going so the recognizer hears the student.
    stopSpeaking();
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
      } catch {
        /* ignore */
      }
    }

    let final = false;
    try {
      const handle = listen({
        lang: 'en-US',
        // Single-utterance mode is the right default — kids speak the
        // sentence once, the recognizer auto-stops on the trailing pause.
        continuous: false,
        onInterim: (txt) => {
          if (!mountedRef.current) return;
          setInterimTranscript(txt);
        },
        onResult: (txt) => {
          if (!mountedRef.current) return;
          final = true;
          setInterimTranscript(txt);
          gradeBrowserStt(txt);
        },
        onError: (err) => {
          if (!mountedRef.current) return;
          // 'no-speech' / 'aborted' aren't fatal — let the student retry.
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setPermError(
              "Mikrofon ruxsati berilmadi. Brauzer sozlamalarida ruxsat bering.",
            );
            setPhase('idle');
            return;
          }
          if (err === 'no-speech') {
            setPermError("Ovoz eshitilmadi — qayta urinib ko'ring.");
            setPhase('idle');
            return;
          }
          // Unknown error — keep the student moving via soft-pass.
          if (typeof console !== 'undefined') {
            console.warn('[SpeakSentence] Web Speech STT error', err);
          }
          setPhase('idle');
        },
        onEnd: () => {
          if (!mountedRef.current) return;
          // If the recognizer ended without a final result (e.g. silence
          // or user-cancel), drop back to idle so the mic button works
          // again. We use the local `final` flag rather than `phase`
          // because the React closure captured a stale value.
          if (!final) {
            setPhase((prev) => (prev === 'recording' ? 'idle' : prev));
          }
        },
      });
      listenHandleRef.current = handle;
      setPhase('recording');
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[SpeakSentence] listen() threw', err);
      }
      setPermError('Brauzer ovozini boshlab boʻlmadi.');
      setPhase('idle');
    }
  }

  function gradeBrowserStt(transcript: string) {
    const finalScore = similarityScore(transcript, sentence);
    if (!mountedRef.current) return;
    setScore(finalScore);
    if (finalScore >= minScore) {
      setPhase('passed');
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
      setTimeout(onPassed, 1500);
    } else {
      setPhase('failed');
      playSound('wrong');
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(120);
        }
      } catch {
        /* ignore */
      }
    }
  }

  function stopListening() {
    const h = listenHandleRef.current;
    if (h) {
      try {
        h.stop();
      } catch {
        /* ignore */
      }
    }
    // Don't flip phase here — `onresult` / `onend` will drive the next state.
  }

  async function startRecording() {
    setPermError('');
    setScore(null);
    setSoftFallback(false);
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        ms.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(ms);
      const mediaRecorder = new MediaRecorder(ms);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        ms.getTracks().forEach((t) => t.stop());
        if (!mountedRef.current) return;
        setStream(null);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await submitAudio(blob);
      };

      mediaRecorder.start();
      setPhase('recording');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermError(
          "Mikrofon ruxsati berilmadi. Brauzer sozlamalarida ruxsat bering.",
        );
      } else {
        setPermError('Mikrofonga ulanishda xato yuz berdi.');
      }
      setPhase('idle');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && phase === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
      setPhase('uploading');
    }
  }

  async function submitAudio(audioBlob: Blob) {
    const token =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('accessToken') ?? '')
        : '';
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const res = await fetch(`${BASE_URL}/ai/speech/assess`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wordEn: sentence, audioBase64 }),
      });
      const json = (await res.json().catch(() => ({}))) as ScoreResult;
      // Unwrap the API's success envelope: { success: true, data: {...} }
      // when the server returned 200. Errors come through with `error`.
      const payload =
        (json as unknown as { data?: ScoreResult }).data ?? json;
      if (!res.ok || typeof payload.score !== 'number') {
        // Distinguish "service not configured" (auto-pass would let the
        // student skip every speaking exercise) from a transient error
        // (network blip — soft-pass is acceptable).
        const code = payload.error ?? (json as { error?: string }).error;
        if (code === 'NOT_CONFIGURED') {
          if (!mountedRef.current) return;
          setPermError(
            'Talaffuz baholash xizmati sozlanmagan. Chrome yoki Edge brauzeridan foydalaning — talaffuz mikrofon orqali baholanadi.',
          );
          setPhase('idle');
          return;
        }
        if (typeof console !== 'undefined') {
          console.warn(
            '[SpeakSentence] /ai/speech/assess unavailable, soft-passing',
            { status: res.status, error: code },
          );
        }
        if (!mountedRef.current) return;
        setSoftFallback(true);
        setPhase('passed');
        playSound('correct');
        setTimeout(onPassed, 1100);
        return;
      }
      json.score = payload.score;
      const finalScore = Math.max(0, Math.min(100, Math.round(json.score)));
      if (!mountedRef.current) return;
      setScore(finalScore);
      if (finalScore >= minScore) {
        setPhase('passed');
        playSound('correct');
        setShowFloater(true);
        setFloaterKey((k) => k + 1);
        setTimeout(onPassed, 1500);
      } else {
        setPhase('failed');
        playSound('wrong');
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(120);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Network or parse failure → soft-pass so the lesson stays playable.
      if (typeof console !== 'undefined') {
        console.warn('[SpeakSentence] submitAudio failed, soft-passing', err);
      }
      setSoftFallback(true);
      setPhase('passed');
      playSound('correct');
      setTimeout(onPassed, 1100);
    }
  }

  function handleRetry() {
    setScore(null);
    setPhase('idle');
    setPermError('');
    setSoftFallback(false);
    setInterimTranscript('');
    chunksRef.current = [];
  }

  /** Mic-button click router — picks browser STT vs server fallback once.
   *  Keeping the routing here (not at component level) means a denied mic
   *  on the browser path can transparently re-route on a future click. */
  function handleMicClick() {
    if (phase === 'recording') {
      if (sttAvailable) stopListening();
      else stopRecording();
      return;
    }
    if (sttAvailable) startListening();
    else void startRecording();
  }

  function getScoreZone(s: number) {
    if (s >= 80) {
      return {
        stroke: '#10b981',
        bg: 'bg-[#dcfce7] border-[#bbf7d0]',
        text: 'text-[#065f46]',
        label: 'Ajoyib talaffuz!',
      };
    }
    if (s >= 50) {
      return {
        stroke: '#fbbf24',
        bg: 'bg-[#fef3c7] border-[#fde68a]',
        text: 'text-[#a16207]',
        label: 'Yaxshi, davom eting',
      };
    }
    return {
      stroke: '#ef4444',
      bg: 'bg-[#fee2e2] border-[#fecaca]',
      text: 'text-[#991b1b]',
      label: "Yana urinib ko'ring",
    };
  }

  // Pre-compute dial geometry — circumference of an r=44 circle.
  const DIAL_R = 44;
  const DIAL_C = 2 * Math.PI * DIAL_R;
  const dialOffset =
    score === null
      ? DIAL_C
      : DIAL_C * (1 - Math.max(0, Math.min(100, score)) / 100);
  const zone = score === null ? null : getScoreZone(score);

  const isRecording = phase === 'recording';
  const isUploading = phase === 'uploading';
  const isPassed = phase === 'passed';
  const isFailed = phase === 'failed';
  const isPlaying = audioState === 'playing';
  const isLoadingTts = audioState === 'loading';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Mascot
            expression={isPassed ? 'happy' : isFailed ? 'sad' : 'idle'}
            size={48}
            animated
          />
        </div>
        <div>
          <p
            className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Jumlani ovozli o&apos;qing
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            Mikrofon tugmasini bosing va jumlani aniq ayting
          </p>
        </div>
      </div>

      {/* Sentence display + small play button */}
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-5 space-y-3">
        <p
          className="text-3xl font-extrabold text-[#3c3c3c] leading-snug text-center"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {sentence}
        </p>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={playTts}
            disabled={isLoadingTts}
            aria-label={isPlaying ? 'Audio o‘ynamoqda' : 'Talaffuz namunasini eshitish'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border-2 border-b-[3px] active:translate-y-[1px] active:border-b-2 transition-all duration-150 disabled:opacity-80 disabled:cursor-wait ${
              audioState === 'error'
                ? 'bg-[#f3f4f6] border-[#9ca3af] text-[#6b7280]'
                : 'bg-white border-[#e8e0d0] text-[#7a5e2c] hover:border-[#c8b890]'
            }`}
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {isLoadingTts ? (
              <Loader2 size={14} className="animate-spin" />
            ) : audioState === 'error' ? (
              <VolumeX size={14} />
            ) : (
              <Volume2 size={14} />
            )}
            <span>Namunani tinglash</span>
          </button>
        </div>
      </div>

      {audioErrorVisible && (
        <div className="bg-[#fef3c7] border-[1.5px] border-[#fde68a] rounded-2xl px-4 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="text-[#d97706] shrink-0 mt-0.5" />
          <p
            className="text-[11px] font-bold text-[#78350f] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Talaffuz audio yuklab bo&apos;lmadi.
          </p>
        </div>
      )}

      {/* Mic permission banner (keeps the lesson unblocked even on denial) */}
      {permError && (
        <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl p-3 space-y-2">
          <p
            className="text-[#991b1b] text-sm font-extrabold"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {permError}
          </p>
          <div className="flex gap-2">
            <Button variant="duo" size="sm" onClick={handleMicClick}>
              Qayta urinish
            </Button>
            <Button variant="ghost" size="sm" onClick={onPassed}>
              O&apos;tkazib yuborish
            </Button>
          </div>
        </div>
      )}

      {/* Score dial reveal */}
      {score !== null && zone && (
        <div className={`rounded-2xl border-[1.5px] p-4 flex items-center gap-4 ${zone.bg}`}>
          <svg width="96" height="96" viewBox="0 0 100 100" className="shrink-0">
            <circle
              cx="50"
              cy="50"
              r={DIAL_R}
              stroke="#e8e0d0"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={DIAL_R}
              stroke={zone.stroke}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={DIAL_C}
              strokeDashoffset={dialOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
            />
            <text
              x="50"
              y="56"
              textAnchor="middle"
              fontSize="22"
              fontWeight="900"
              fill="#3c3c3c"
              fontFamily="var(--font-display, var(--font-nunito))"
            >
              {score}
            </text>
          </svg>
          <div className="flex-1">
            <p
              className={`font-extrabold text-lg ${zone.text}`}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {zone.label}
            </p>
            <p className="text-[#777] text-xs font-bold">
              {score} / 100 (kerakli: {minScore})
            </p>
          </div>
        </div>
      )}

      {/* Soft-fallback (Azure unavailable) banner */}
      {softFallback && (
        <div className="bg-[#fef3c7] border-[1.5px] border-[#fde68a] rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-[#d97706] shrink-0 mt-0.5" />
          <p
            className="text-xs font-bold text-[#78350f] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ovozni baholash xizmati hozir mavjud emas — keyingi mashqqa o&apos;tamiz.
          </p>
        </div>
      )}

      {/* Record button + waveform */}
      {!isPassed && !isFailed && !permError && (
        <div className="flex flex-col items-center gap-3 py-2">
          {!isUploading && (
            <div className="relative w-24 h-24 flex items-center justify-center">
              {isRecording && (
                <span
                  className="absolute inset-0 rounded-full bg-[#ef4444]/30 motion-safe:[animation:pulse-ring_1.2s_ease-out_infinite]"
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                onClick={handleMicClick}
                aria-label={isRecording ? "Yozishni to'xtatish" : 'Yozib olish'}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white border-b-[6px] active:translate-y-[2px] active:border-b-[3px] transition-all duration-150 ${
                  isRecording
                    ? 'bg-[#ef4444] border-[#b91c1c]'
                    : 'bg-[#58cc02] border-[#46a302]'
                }`}
              >
                {isRecording ? (
                  <Square size={36} fill="currentColor" />
                ) : (
                  <Mic size={36} />
                )}
              </button>
            </div>
          )}

          {isUploading && (
            <div className="flex flex-col items-center gap-2 py-6">
              <span className="w-8 h-8 border-2 border-[#58cc02]/30 border-t-[#58cc02] rounded-full animate-spin" />
              <p className="text-[#777] text-sm font-bold">Tekshirilmoqda...</p>
            </div>
          )}

          {/* Live caption — only meaningful on the browser-STT path. The
              waveform is irrelevant when there's no MediaStream, so we
              show one OR the other, never both. */}
          {sttAvailable ? (
            isRecording && (
              <div className="w-full max-w-md min-h-[2.5rem] bg-[#fffaf0] border-[1.5px] border-[#e8e0d0] rounded-2xl px-4 py-2 text-center">
                <p
                  className="text-sm font-extrabold text-[#3c3c3c] leading-snug"
                  style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                >
                  {interimTranscript || (
                    <span className="text-[#cbbf9c]">Tinglanmoqda...</span>
                  )}
                </p>
              </div>
            )
          ) : (
            !isUploading && <Waveform stream={stream} active={isRecording} />
          )}

          {!isUploading && !isRecording && (
            <p className="text-[#777] text-xs font-bold text-center">
              Mikrofon tugmasini bosing va jumlani baland o&apos;qing
            </p>
          )}
        </div>
      )}

      {/* +10 XP floater on pass */}
      {showFloater && (
        <div className="relative h-0">
          <div className="absolute right-3 -top-3 pointer-events-none">
            <XpFloater
              key={floaterKey}
              amount={10}
              onDone={() => setShowFloater(false)}
            />
          </div>
        </div>
      )}

      {/* Pass banner */}
      {isPassed && !softFallback && (
        <div className="bg-[#dcfce7] border-[1.5px] border-[#bbf7d0] rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-[#10b981] shrink-0" />
          <p
            className="text-sm font-extrabold text-[#065f46]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ajoyib talaffuz!
          </p>
        </div>
      )}

      {/* Fail banner with retry + skip + ExplainPanel (pronunciation tips) */}
      {isFailed && (
        <div className="space-y-3">
          <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
            <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <p
              className="text-sm font-extrabold text-[#991b1b] leading-snug"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              Talaffuz {minScore} balldan past — qayta urinib ko&apos;ring.
            </p>
          </div>
          <ExplainPanel
            exerciseType="speak_sentence"
            question="Speaking pronunciation"
            studentAnswer={`audio recording (score ${score ?? 0}/100)`}
            correctAnswer={sentence}
          />
          <div className="flex gap-2">
            <Button variant="duo" size="lg" fullWidth onClick={handleRetry}>
              Qayta yozish
            </Button>
            <Button
              variant="duo"
              size="lg"
              className="!bg-[#ef4444] !border-[#b91c1c]"
              onClick={onFailed}
            >
              Davom etish
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpeakSentence;
