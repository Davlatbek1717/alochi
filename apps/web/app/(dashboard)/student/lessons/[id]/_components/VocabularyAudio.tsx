'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { playSound } from '@/lib/sound';
import {
  getSpeechCapabilities,
  listen,
  similarityScore,
  speak,
  stopSpeaking,
} from '@/lib/speech';
import { Waveform } from './Waveform';

type VocabularyAudioProps = {
  word: string;
  lessonId: string;
  /** Optional callbacks so the lesson runner can advance / decrement hearts. */
  onPassed?: () => void;
  onFailed?: () => void;
};

type ScoreResult = {
  score: number;
};

/**
 * Pass 5 — Duolingo-grade pronunciation panel:
 *   - Word displayed text-5xl extrabold centered
 *   - 96×96 circular record button with pulse ring while recording
 *   - 5-bar live waveform driven by AnalyserNode RMS
 *   - Score reveal as 0-100 SVG dial with red/yellow/green zones
 *   - On pass (≥75): correct chime + auto-advance
 *   - On fail: wrong buzz + retry banner
 *
 * Falls back to a text-input flow after 3 consecutive Azure speech failures so
 * the user can still progress when the speech service is unreachable.
 */
export default function VocabularyAudio({ word, lessonId, onPassed, onFailed }: VocabularyAudioProps) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [permError, setPermError] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Phase 21.2: after 3 consecutive Azure speech failures we fall back to a
  // text-input flow so the user can still progress.
  const [azureFails, setAzureFails] = useState(0);
  const [audioMode, setAudioMode] = useState(true);
  const [textAnswer, setTextAnswer] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listenHandleRef = useRef<{ stop: () => void } | null>(null);

  // Browser TTS support — drives whether to render the "Eshitish" pronunciation
  // example button. Computed once on mount so SSR/hydration stay consistent.
  const [ttsAvailable, setTtsAvailable] = useState(false);
  // Browser STT support — when present we skip the MediaRecorder upload path
  // entirely and grade via Levenshtein similarity against the target word.
  const [sttAvailable, setSttAvailable] = useState(false);
  useEffect(() => {
    const caps = getSpeechCapabilities();
    setTtsAvailable(caps.tts);
    setSttAvailable(caps.stt);
    return () => {
      // Stop any in-flight pronunciation example when the exercise unmounts.
      stopSpeaking();
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function playExample() {
    if (!ttsAvailable) return;
    void speak(word, { lang: 'en-US', rate: 0.9 }).catch(() => {
      // Silent — pronunciation example is a nice-to-have.
    });
  }

  // Whenever a score is set, route it to onPassed/onFailed once.
  useEffect(() => {
    if (score === null) return;
    if (score >= 75) {
      playSound('correct');
      const t = setTimeout(() => onPassed?.(), 900);
      return () => clearTimeout(t);
    } else {
      playSound('wrong');
    }
  }, [score, onPassed]);

  async function startRecording() {
    setPermError('');
    setScore(null);
    // Browser STT is preferred — instant local scoring, no upload, no
    // Azure key needed. Falls through to MediaRecorder + /ai/speech/assess
    // on browsers that lack Web Speech API (mostly older Firefox).
    if (sttAvailable) {
      startBrowserStt();
      return;
    }
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(ms);
      const mediaRecorder = new MediaRecorder(ms);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        ms.getTracks().forEach((t) => t.stop());
        setStream(null);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await submitAudio(audioBlob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermError("Mikrofon ruxsati berilmadi. Brauzer sozlamalarida ruxsat bering.");
      } else {
        setPermError('Mikrofonga ulanishda xato yuz berdi.');
      }
    }
  }

  function startBrowserStt() {
    let final = false;
    try {
      const handle = listen({
        lang: 'en-US',
        continuous: false,
        onInterim: () => {
          /* could surface live transcript later; not needed for single-word UX */
        },
        onResult: (txt) => {
          final = true;
          gradeBrowserStt(txt);
        },
        onError: (err) => {
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setPermError(
              'Mikrofon ruxsati berilmadi. Brauzer sozlamalarida ruxsat bering.',
            );
          } else if (err === 'no-speech') {
            setPermError("Ovoz eshitilmadi — qayta urinib ko'ring.");
          }
          setRecording(false);
        },
        onEnd: () => {
          // If the recognizer wrapped up without a final result (silence,
          // user cancel), reset the button to idle.
          if (!final) setRecording(false);
        },
      });
      listenHandleRef.current = handle;
      setRecording(true);
    } catch {
      setPermError("Brauzer ovozini boshlab bo'lmadi.");
    }
  }

  function gradeBrowserStt(transcript: string) {
    const finalScore = similarityScore(transcript, word);
    setScore(finalScore);
    setRecording(false);
    // Reset Azure-fail counter — student successfully completed a turn
    // via the browser path, so we shouldn't drop them into text-mode.
    setAzureFails(0);
    if (finalScore < 75) onFailed?.();
  }

  function stopRecording() {
    if (sttAvailable && listenHandleRef.current) {
      try {
        listenHandleRef.current.stop();
      } catch {
        /* ignore */
      }
      setRecording(false);
      return;
    }
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setLoading(true);
    }
  }

  async function submitAudio(audioBlob: Blob) {
    const token = localStorage.getItem('accessToken') ?? '';
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    try {
      // The backend's @Post('speech/assess') expects JSON
      // { wordEn, audioBase64 }, not multipart. Encode the blob to base64
      // and send as JSON so the request actually scores instead of 400ing.
      const audioBase64 = await blobToBase64(audioBlob);

      const res = await fetch(`${BASE_URL}/ai/speech/assess`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wordEn: word, audioBase64 }),
      });

      const json = (await res.json()) as ScoreResult & {
        error?: string;
        data?: ScoreResult & { error?: string };
      };
      // The API wraps successes in { success: true, data: {...} }.
      const payload = json.data ?? json;
      const errorCode = payload.error ?? json.error;
      if (errorCode === 'NOT_CONFIGURED') {
        // Azure isn't set up. We're already on the upload path because
        // browser STT isn't available either — switch the student to
        // text-mode now instead of waiting for 3 retries.
        setAudioMode(false);
        setPermError('');
        return;
      }
      if (!res.ok || typeof payload.score !== 'number') {
        throw new Error(errorCode ?? 'Xato yuz berdi');
      }
      const finalScore = payload.score;
      setScore(finalScore);
      setAzureFails(0); // success → reset counter
      if (finalScore < 75) onFailed?.();
    } catch (err) {
      setPermError(err instanceof Error ? err.message : 'Yuborishda xato yuz berdi');
      setAzureFails((c) => {
        const next = c + 1;
        // After 3 consecutive Azure failures, switch to text-input fallback.
        if (next >= 3) setAudioMode(false);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('FileReader did not return a string'));
          return;
        }
        // strip the "data:audio/webm;base64," prefix
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  }

  function submitTextAnswer() {
    const trimmed = textAnswer.trim();
    if (!trimmed) return;
    // Simple local match: case-insensitive equality with the target word.
    const ok = trimmed.toLowerCase() === word.toLowerCase();
    const finalScore = ok ? 100 : 50;
    setScore(finalScore);
    setPermError('');
    if (!ok) onFailed?.();
  }

  function getScoreZone(s: number) {
    if (s >= 80) {
      return {
        stroke: '#10b981',
        bg: 'bg-[#dcfce7] border-[#bbf7d0]',
        text: 'text-[#065f46]',
        label: 'Ajoyib!',
      };
    }
    if (s >= 60) {
      return {
        stroke: '#fbbf24',
        bg: 'bg-[#fef3c7] border-[#fde68a]',
        text: 'text-[#a16207]',
        label: 'Yaxshi',
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
    score === null ? DIAL_C : DIAL_C * (1 - Math.max(0, Math.min(100, score)) / 100);
  const zone = score === null ? null : getScoreZone(score);

  return (
    <div className="bg-white rounded-3xl p-6 border-[1.5px] border-[#e8e0d0] space-y-5">
      {/* Word display */}
      <div className="text-center space-y-1">
        <p
          className="text-xs font-extrabold uppercase tracking-wider text-[#777]"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Bu so&apos;zni o&apos;qing
        </p>
        <p
          className="text-5xl font-extrabold text-[#3c3c3c] leading-tight"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {word}
        </p>
        {/* Pronunciation example — Web Speech only; hidden if unsupported so
            we don't dangle a dead button. Server fallback isn't worth the
            complexity here since the recording flow already works fine. */}
        {ttsAvailable && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={playExample}
              aria-label="Talaffuz namunasini eshitish"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border-2 border-b-[3px] active:translate-y-[1px] active:border-b-2 transition-all duration-150 bg-white border-[#e8e0d0] text-[#7a5e2c] hover:border-[#c8b890]"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              <Volume2 size={14} />
              <span>Talaffuzni eshitish</span>
            </button>
          </div>
        )}
      </div>

      {permError && (
        <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl p-3">
          <p className="text-[#991b1b] text-sm font-bold">{permError}</p>
        </div>
      )}

      {!audioMode && (
        <div className="bg-[#fef3c7] border-[1.5px] border-[#fde68a] rounded-2xl p-3">
          <p className="text-[#a16207] text-sm font-bold">
            Ovoz aniqlanmadi. Iltimos, javobni yozing.
          </p>
        </div>
      )}

      {/* Score dial reveal */}
      {score !== null && zone && (
        <div className={`rounded-2xl border-[1.5px] p-4 flex items-center gap-4 ${zone.bg}`}>
          <svg width="96" height="96" viewBox="0 0 100 100" className="shrink-0">
            <circle cx="50" cy="50" r={DIAL_R} stroke="#e8e0d0" strokeWidth="8" fill="none" />
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
            <p className="text-[#777] text-xs font-bold">{score} / 100</p>
          </div>
        </div>
      )}

      {audioMode ? (
        <div className="flex flex-col items-center gap-4">
          {/* Big circular record button */}
          {!loading && (
            <div className="relative w-24 h-24 flex items-center justify-center">
              {recording && (
                <span
                  className="absolute inset-0 rounded-full bg-[#58cc02]/40 motion-safe:[animation:pulse-ring_1.2s_ease-out_infinite]"
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                aria-label={recording ? "Yozishni to'xtatish" : 'Yozib olish'}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white border-b-[6px] active:translate-y-[2px] active:border-b-[3px] transition-all duration-150 ${
                  recording
                    ? 'bg-[#ef4444] border-[#b91c1c]'
                    : 'bg-[#58cc02] border-[#46a302]'
                }`}
              >
                {recording ? <Square size={36} fill="currentColor" /> : <Mic size={36} />}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-2 py-6">
              <span className="w-8 h-8 border-2 border-[#58cc02]/30 border-t-[#58cc02] rounded-full animate-spin" />
              <p className="text-[#777] text-sm font-bold">Tekshirilmoqda...</p>
            </div>
          )}

          {/* Live waveform */}
          {!loading && <Waveform stream={stream} active={recording} />}

          {!loading && !recording && (
            <p className="text-[#777] text-xs font-bold text-center">
              Mikrofon tugmasini bosing va so&apos;zni baland ovozda o&apos;qing
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="So'zni yozing"
            className="border-[1.5px] border-[#e8e0d0] rounded-2xl px-4 py-3 text-base font-bold text-[#3c3c3c] focus:outline-none focus:border-[#58cc02]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          />
          <Button variant="duo" size="lg" fullWidth onClick={submitTextAnswer}>
            Yuborish
          </Button>
          <button
            type="button"
            onClick={() => {
              setAudioMode(true);
              setAzureFails(0);
              setPermError('');
            }}
            className="text-[#58cc02] text-xs font-extrabold underline self-center"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ovoz bilan qayta urinish
          </button>
        </div>
      )}
    </div>
  );
}
