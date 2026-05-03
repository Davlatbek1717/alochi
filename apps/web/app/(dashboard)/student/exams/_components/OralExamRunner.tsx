'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Square,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Volume2,
  StopCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { listen, getSpeechCapabilities } from '@/lib/speech';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton } from '@/components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationTurn {
  role: 'ai' | 'student';
  text: string;
  ts: string;
}

interface StartResponse {
  sessionId: string;
  transcript: ConversationTurn[];
  message: string;
  isFinal: boolean;
  language: 'uz' | 'en';
  maxMinutes: number;
}

interface RespondResponse {
  sessionId: string;
  transcript: ConversationTurn[];
  message: string;
  isFinal: boolean;
  score?: number;
  passed?: boolean;
  analysis?: {
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
  } | null;
}

interface FinalizeResponse {
  sessionId: string;
  score: number;
  passed: boolean;
  analysis: {
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
  } | null;
  message: string;
  isFinal: true;
}

interface InitialResult {
  score: number;
  passed: boolean;
  message: string;
  analysis: {
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
  } | null;
}

interface Props {
  permissionId: string;
  examTitle: string;
  language: 'uz' | 'en';
  passThreshold: number;
  maxMinutes: number;
  /** When the student already completed this exam, the parent passes
   *  the saved result so we can rehydrate the result screen on
   *  refresh instead of restarting the conversation. */
  initialResult?: InitialResult | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AI-driven oral exam runner. Browser-only flow (Path 1):
 *   - Web Speech `listen()` for STT (mic → text)
 *   - SpeechSynthesis for TTS (AI text → spoken voice)
 *   - Server proxies LLM calls and persists transcript
 *
 * The AI speaks first (loaded from /start). Student records their reply,
 * we POST the transcribed text to /respond, get the next AI turn, speak
 * it. Loop until the AI returns isFinal=true OR the student hits
 * "Tugatdim" → /finalize.
 */
export function OralExamRunner({
  permissionId,
  examTitle,
  language,
  passThreshold,
  maxMinutes,
  initialResult,
}: Props) {
  const router = useRouter();
  // Two-phase init:
  //   `started=false` — pre-flight screen. Browsers block speech
  //                    synthesis until a user gesture, so we render a
  //                    "Imtihonni boshlash" CTA. The student tap also
  //                    primes the audio context.
  //   `started=true`  — fetched /start, AI is talking, conversation
  //                    is live.
  // If the parent supplied an `initialResult`, we skip both phases
  // and jump to the result screen — that's the saved-state path used
  // when the student lands here after an exam they already finished.
  const [started, setStarted] = useState(false);
  const [transcript, setTranscript] = useState<ConversationTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [studentDraft, setStudentDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalizeResponse | null>(
    initialResult
      ? {
          sessionId: '',
          score: initialResult.score,
          passed: initialResult.passed,
          analysis: initialResult.analysis,
          message: initialResult.message,
          isFinal: true,
        }
      : null,
  );
  const [sttSupported, setSttSupported] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  const listenHandleRef = useRef<{ stop: () => void } | null>(null);
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number>(Date.now());

  // ── Helpers ──────────────────────────────────────────────────────────────
  const langTag = language === 'uz' ? 'uz-UZ' : 'en-US';

  /**
   * Speak the given text via SpeechSynthesis. Cancels any ongoing
   * utterance first. Tracks `aiSpeaking` so the mic button can be
   * disabled while the AI is talking (prevents the AI's voice from
   * being captured as the student's response on speakers).
   */
  const speakAi = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = langTag;
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.onstart = () => setAiSpeaking(true);
      utter.onend = () => setAiSpeaking(false);
      utter.onerror = () => setAiSpeaking(false);
      ttsUtteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
    },
    [langTag],
  );

  function stopAiSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAiSpeaking(false);
  }

  function appendTurn(turn: ConversationTurn) {
    setTranscript((prev) => [...prev, turn]);
  }

  // Detect STT capability + cleanup on unmount. Session start is
  // gated behind the user's "Boshlash" tap (see beginExam below) so
  // SpeechSynthesis has the gesture it needs to play the AI's voice.
  useEffect(() => {
    setSttSupported(getSpeechCapabilities().stt);
    return () => {
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /**
   * Student tapped "Imtihonni boshlash". This counts as the audio
   * gesture, so we can also kick off /start and immediately speak the
   * AI's opening line. Calling speechSynthesis here (synchronously
   * inside the click handler) primes the engine even though we'll
   * actually call it later when the response lands.
   */
  async function beginExam() {
    if (started || loading) return;
    // Pre-flight: a no-op utterance to unlock SpeechSynthesis on
    // browsers that throttle it without a recent user gesture.
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const warm = new SpeechSynthesisUtterance(' ');
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      } catch {
        /* ignore */
      }
    }
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<StartResponse>(
        `/exams/oral/${permissionId}/start`,
        { method: 'POST', body: JSON.stringify({}) },
        token,
      );
      const data = res.data;
      setTranscript(data.transcript ?? []);
      startedAtRef.current = Date.now();
      setStarted(true);
      const lastAi = [...(data.transcript ?? [])]
        .reverse()
        .find((t) => t.role === 'ai');
      if (lastAi?.text) speakAi(lastAi.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sessiya boshlanmadi');
    } finally {
      setLoading(false);
    }
  }

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript, finalResult]);

  // Auto-mute the mic while the AI is speaking — otherwise the speech
  // engine picks up the AI's voice through the device speakers and
  // transcribes it as the student's response. This was the cause of
  // the "huge auto-typed paragraph" bug on first oral-exam test.
  useEffect(() => {
    if (aiSpeaking && listening) {
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      // Drop any in-flight interim that was definitely the AI talking.
      setInterim('');
    }
  }, [aiSpeaking, listening]);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  function toggleMic() {
    if (listening) {
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    // Don't even open the mic while AI is speaking — would just
    // capture echo. The button is disabled in this state, but guard
    // here too in case state changes between render and click.
    if (aiSpeaking) {
      stopAiSpeech();
    }
    try {
      // Cache draft prefix at start: the lib's `listen()` emits the
      // CUMULATIVE finalised transcript for the current session each
      // time, so we treat each onResult as a REPLACEMENT of the
      // session's contribution — not an append. The user's prior draft
      // (typed or from a previous mic session that was stopped) lives
      // in `prefix`; the live transcript is appended to it.
      const prefix = studentDraft.trim();
      const handle = listen({
        lang: langTag,
        continuous: true,
        onInterim: (txt) => {
          setInterim(prefix ? `${prefix} ${txt}`.trim() : txt);
        },
        onResult: (txt) => {
          setStudentDraft(prefix ? `${prefix} ${txt}`.trim() : txt);
          setInterim('');
        },
        onError: (err) => {
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setError(
              'Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.',
            );
          } else if (err === 'no-speech') {
            setError("Ovoz eshitilmadi. Mikrofonni tekshiring.");
          }
          setListening(false);
        },
        onEnd: () => setListening(false),
      });
      listenHandleRef.current = handle;
      setListening(true);
      setError(null);
    } catch {
      setError("Brauzer ovozini boshlab bo'lmadi.");
    }
  }

  // ── Send student draft to server, get next AI turn ────────────────────────
  async function sendResponse() {
    const text = studentDraft.trim();
    if (!text || submitting || finalizing) return;
    setSubmitting(true);
    setError(null);

    // Stop mic if still listening when send is pressed.
    if (listening) {
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
    }

    // Optimistic append so the chat doesn't feel janky.
    appendTurn({ role: 'student', text, ts: new Date().toISOString() });
    setStudentDraft('');
    setInterim('');

    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<RespondResponse>(
        `/exams/oral/${permissionId}/respond`,
        { method: 'POST', body: JSON.stringify({ text }) },
        token,
      );
      const data = res.data;
      setTranscript(data.transcript ?? []);
      if (data.isFinal && typeof data.score === 'number') {
        setFinalResult({
          sessionId: data.sessionId,
          score: data.score,
          passed: data.passed ?? false,
          analysis: data.analysis ?? null,
          message: data.message,
          isFinal: true,
        });
        speakAi(data.message);
      } else {
        speakAi(data.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yuborib bo\'lmadi');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Force-finalize ────────────────────────────────────────────────────────
  async function tugatdim() {
    if (finalizing || finalResult) return;
    if (!window.confirm('Imtihonni tugatishga ishonchingiz komilmi?')) return;
    setFinalizing(true);
    setError(null);
    if (listening) {
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
    }
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<FinalizeResponse>(
        `/exams/oral/${permissionId}/finalize`,
        { method: 'POST', body: JSON.stringify({}) },
        token,
      );
      setFinalResult(res.data);
      if (res.data.message) speakAi(res.data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yakunlab boʻlmadi');
    } finally {
      setFinalizing(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Pre-flight intro. Browsers (Chrome/Safari) block SpeechSynthesis
  // until the page sees a user gesture, so we MUST not auto-fire the
  // AI's voice on mount. The "Imtihonni boshlash" CTA is that gesture.
  if (!started && !finalResult) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-6 md:p-8 space-y-5 text-center">
          <div className="w-20 h-20 rounded-3xl bg-violet-100 border-2 border-violet-200 flex items-center justify-center mx-auto">
            <Volume2 size={40} className="text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[#0f172a]">
              {language === 'uz' ? "Og'zaki imtihon" : 'Oral exam'}
            </p>
            <p className="text-sm font-bold text-[#64748b] mt-1.5 leading-snug">
              {examTitle}
            </p>
          </div>
          <ul className="text-left text-xs font-semibold text-[#64748b] space-y-2 bg-[#f7f4ef] rounded-2xl p-4">
            <li className="flex items-start gap-2">
              <Volume2 size={14} className="text-violet-600 shrink-0 mt-0.5" />
              <span>
                AI siz bilan{' '}
                {language === 'uz' ? "o'zbek tilida" : 'inglizcha'}{' '}
                gapiradi va savollar beradi
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Mic size={14} className="text-rose-600 shrink-0 mt-0.5" />
              <span>Mikrofon orqali ovoz bilan javob bering</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                Maks. {maxMinutes} daqiqa · O&apos;tish uchun {passThreshold}%
              </span>
            </li>
          </ul>
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-left">
              <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-rose-800 leading-snug">
                {error}
              </p>
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading}
            className="!bg-violet-600 hover:!bg-violet-700 !border-violet-700 !rounded-xl !py-4"
            onClick={beginExam}
          >
            {loading ? '...' : "Imtihonni boshlash"}
          </Button>
          <p className="text-[11px] text-[#94a3b8] font-semibold">
            Boshlaganingizdan so&apos;ng AI darhol gapira boshlaydi.
            Mikrofon ruxsatini bering.
          </p>
        </div>
      </div>
    );
  }

  if (loading && started) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-3">
        <Skeleton theme="light" className="h-16 w-full rounded-2xl" />
        <Skeleton theme="light" className="h-32 w-full rounded-2xl" />
        <Skeleton theme="light" className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────
  if (finalResult) {
    const passed = finalResult.passed;
    const a = finalResult.analysis ?? {};
    return (
      <div className="min-h-screen bg-[#f7f4ef] px-4 md:px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto space-y-5">
          <div
            className={`rounded-3xl border-[1.5px] p-6 md:p-8 text-center ${
              passed ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}
          >
            <div
              className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 ${
                passed ? 'bg-emerald-100' : 'bg-rose-100'
              }`}
            >
              {passed ? (
                <CheckCircle2 size={42} className="text-emerald-600" />
              ) : (
                <XCircle size={42} className="text-rose-600" />
              )}
            </div>
            <p className="text-3xl md:text-4xl font-extrabold text-[#0f172a]">
              {passed ? "O'tdingiz!" : "O'ta olmadingiz"}
            </p>
            <p className="text-lg font-bold text-[#64748b] mt-1">
              {finalResult.score} / 100
              <span className="text-sm font-semibold ml-1">
                ({passThreshold}% kerak)
              </span>
            </p>
            {finalResult.message && (
              <p className="text-sm text-[#0f172a] font-semibold mt-4">
                {finalResult.message}
              </p>
            )}
          </div>

          {(a.strengths?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 mb-2">
                Kuchli tomonlaringiz
              </p>
              <ul className="space-y-1.5 text-sm text-[#0f172a]">
                {a.strengths!.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-0.5">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(a.weaknesses?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
              <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700 mb-2">
                Yaxshilash uchun
              </p>
              <ul className="space-y-1.5 text-sm text-[#0f172a]">
                {a.weaknesses!.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">!</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(a.recommendations?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
              <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700 mb-2">
                Tavsiyalar
              </p>
              <ul className="space-y-1.5 text-sm text-[#0f172a]">
                {a.recommendations!.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Sparkles size={14} className="text-violet-600 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl !py-4"
            onClick={() => router.push('/student')}
          >
            Bosh sahifaga
          </Button>
        </div>
      </div>
    );
  }

  // ── Active conversation ──────────────────────────────────────────────────
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedDispSec = elapsedSec % 60;
  const overTime = elapsedMin >= maxMinutes;

  return (
    <div className="min-h-screen bg-[#f7f4ef] flex flex-col">
      {/* Header — exam title + timer + finish button */}
      <div className="bg-[#0f172a] px-4 md:px-6 pt-4 pb-4 sticky top-0 z-30 border-b border-white/5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Volume2 size={18} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
              AI og&apos;zaki imtihon · {language === 'uz' ? "O'zbek" : 'English'}
            </p>
            <p className="text-white font-bold text-sm truncate">{examTitle}</p>
          </div>
          <div className="text-right shrink-0">
            <p
              className={`text-sm font-extrabold font-mono ${
                overTime ? 'text-rose-300' : 'text-white'
              }`}
            >
              {elapsedMin}:{String(elapsedDispSec).padStart(2, '0')}
            </p>
            <p className="text-[10px] font-bold text-[#94a3b8]">/ {maxMinutes} min</p>
          </div>
        </div>
      </div>

      {/* Conversation transcript */}
      <div className="flex-1 px-4 md:px-6 py-5 max-w-3xl mx-auto w-full space-y-3">
        {transcript.map((turn, i) => (
          <div
            key={i}
            className={`flex ${turn.role === 'student' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl text-sm font-semibold leading-relaxed ${
                turn.role === 'student'
                  ? 'bg-[#0d9488] text-white rounded-tr-md'
                  : 'bg-white border-l-4 border-violet-500 text-[#0f172a] rounded-tl-md'
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}

        {aiSpeaking && (
          <div className="flex justify-start">
            <div className="bg-white border-l-4 border-violet-500 px-4 py-2 rounded-2xl rounded-tl-md inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse" />
              <span
                className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse"
                style={{ animationDelay: '120ms' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse"
                style={{ animationDelay: '240ms' }}
              />
              <span className="text-xs font-bold text-violet-700 ml-1">
                AI gapiryapti
              </span>
            </div>
          </div>
        )}

        {(submitting || finalizing) && !aiSpeaking && (
          <div className="flex justify-start">
            <div className="bg-white border-l-4 border-violet-500 px-4 py-2 rounded-2xl rounded-tl-md text-xs font-bold text-[#64748b]">
              {finalizing ? 'Imtihon yakunlanmoqda...' : "AI o'ylayapti..."}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-800 leading-snug">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — sticky bottom */}
      <div className="sticky bottom-0 bg-white border-t border-[#ede9e1] px-4 md:px-6 py-3">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Live transcription preview (only when listening) */}
          {(listening || studentDraft) && (
            <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a]">
              {studentDraft && (
                <span className="font-semibold">{studentDraft}</span>
              )}
              {interim && (
                <span className="text-[#94a3b8] italic"> {interim}</span>
              )}
              {!studentDraft && !interim && (
                <span className="text-[#94a3b8] italic">Tinglanmoqda...</span>
              )}
            </div>
          )}

          {!sttSupported && !studentDraft && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-amber-800">
              Brauzeringiz mikrofonni qo&apos;llab-quvvatlamaydi. Chrome yoki
              Edge ishlatib ko&apos;ring.
            </div>
          )}

          <div className="flex items-center gap-2">
            {sttSupported && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={submitting || finalizing || aiSpeaking}
                aria-label={listening ? "To'xtatish" : 'Mikrofonni yoqish'}
                title={
                  aiSpeaking
                    ? 'AI gapirib bo\'lguniga qadar kuting'
                    : listening
                      ? "To'xtatish"
                      : 'Mikrofonni yoqish'
                }
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 transition-all ${
                  listening
                    ? 'bg-rose-600 motion-safe:animate-pulse'
                    : 'bg-violet-600 hover:bg-violet-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {listening ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
              </button>
            )}

            {/* Manual text input as a fallback (also handy for testing) */}
            <input
              type="text"
              value={studentDraft}
              onChange={(e) => setStudentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendResponse();
                }
              }}
              placeholder={
                listening
                  ? 'Tinglanmoqda...'
                  : language === 'uz'
                    ? 'Yoki yozing...'
                    : 'Or type your answer...'
              }
              disabled={submitting || finalizing}
              className="flex-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-3 text-sm text-[#0f172a] focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />

            <button
              type="button"
              onClick={sendResponse}
              disabled={!studentDraft.trim() || submitting || finalizing}
              aria-label="Javobni yuborish"
              className="w-12 h-12 rounded-full flex items-center justify-center bg-[#0d9488] hover:bg-teal-700 text-white shrink-0 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            {aiSpeaking ? (
              <button
                type="button"
                onClick={stopAiSpeech}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-[#0f172a]"
              >
                <StopCircle size={14} /> AI ovozini to&apos;xtatish
              </button>
            ) : (
              <span className="text-[11px] text-[#94a3b8] font-semibold">
                Mikrofon orqali javob bering yoki yozing
              </span>
            )}
            <button
              type="button"
              onClick={tugatdim}
              disabled={finalizing}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Tugatdim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
