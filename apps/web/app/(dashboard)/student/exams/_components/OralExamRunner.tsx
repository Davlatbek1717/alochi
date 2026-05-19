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
  RotateCcw,
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
  questionCount: number;
  answeredCount: number;
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
  questionCount?: number;
  answeredCount?: number;
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

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Auto-stop the mic this many milliseconds after the last new transcript
 * chunk arrives. Voice activity detection via "no new STT result for X
 * seconds" — cheap and works on every browser the Web Speech API does.
 */
const SILENCE_TIMEOUT_MS = 3000;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AI-driven oral exam runner — mic-only flow.
 *
 *   - AI speaks each question via SpeechSynthesis
 *   - Student records via Web Speech `listen()`, mic auto-stops after
 *     SILENCE_TIMEOUT_MS without new transcript OR a tap on the stop button
 *   - Student sees the transcribed answer with "Qayta yozish" + "Yuborish"
 *     so STT mishears are recoverable in one tap
 *   - When the server returns isFinal=true the exam finalizes automatically;
 *     no manual "Tugatdim" button (it would defeat the question budget)
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
  //   started=false — pre-flight screen. Browsers block SpeechSynthesis
  //                   until a user gesture; the "Boshlash" tap unlocks
  //                   the audio context.
  //   started=true  — fetched /start, AI is talking, exam is live.
  const [started, setStarted] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [phase, setPhase] = useState<'listening-to-ai' | 'ready' | 'recording' | 'review' | 'submitting' | 'finalizing'>('listening-to-ai');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [interim, setInterim] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const langTag = language === 'uz' ? 'uz-UZ' : 'en-US';

  // ── TTS ──────────────────────────────────────────────────────────────────

  // For Uzbek exams: check whether a real uz-UZ voice is installed.
  // Browser uz-UZ TTS is often missing or robotic on Android; fall back
  // to en-US so at least English vocabulary is intelligible.
  function resolvedTtsLang(text: string): string {
    if (language !== 'uz') return 'en-US';
    const voices = window.speechSynthesis?.getVoices() ?? [];
    const hasUz = voices.some((v) => v.lang.startsWith('uz'));
    if (!hasUz) return 'en-US';
    // If the text is mostly Latin (Uzbek Latin script) and contains obvious
    // English vocabulary markers, use en-US for better intelligibility.
    const latin = (text.match(/[A-Za-z]/g) ?? []).length;
    const total = text.replace(/\s/g, '').length;
    return latin / (total || 1) > 0.85 ? 'en-US' : 'uz-UZ';
  }

  const speakAi = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = resolvedTtsLang(text);
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.onstart = () => {
        setAiSpeaking(true);
        setPhase('listening-to-ai');
      };
      utter.onend = () => {
        setAiSpeaking(false);
        // After AI finishes speaking, student is ready to answer.
        setPhase((p) => (p === 'listening-to-ai' ? 'ready' : p));
      };
      utter.onerror = () => {
        setAiSpeaking(false);
        setPhase((p) => (p === 'listening-to-ai' ? 'ready' : p));
      };
      ttsUtteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
    },
    [langTag],
  );

  // ── Detect capabilities + cleanup ────────────────────────────────────────

  useEffect(() => {
    setSttSupported(getSpeechCapabilities().stt);
    return () => {
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Elapsed timer ────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Begin exam ───────────────────────────────────────────────────────────

  async function beginExam() {
    if (started || loading) return;
    // Pre-flight warm-up so SpeechSynthesis is allowed to speak later.
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
      startedAtRef.current = Date.now();
      setStarted(true);
      setQuestionCount(data.questionCount ?? 5);
      setAnsweredCount(data.answeredCount ?? 0);
      // Use the latest AI turn (covers resume of an in-progress session).
      const lastAi = [...(data.transcript ?? [])]
        .reverse()
        .find((t) => t.role === 'ai');
      const q = lastAi?.text ?? data.message;
      setAiQuestion(q);
      speakAi(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sessiya boshlanmadi');
    } finally {
      setLoading(false);
    }
  }

  // ── Mic — start / stop / silence detection ───────────────────────────────

  function resetSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      stopMic();
    }, SILENCE_TIMEOUT_MS);
  }

  function startMic() {
    if (phase === 'recording' || aiSpeaking) return;
    setStudentAnswer('');
    setInterim('');
    setError(null);
    // For English exams try en-US first; if the recogniser errors out
    // (network locale mismatch, service unavailable for that dialect)
    // fall back to en-GB so British-accented speech is also accepted.
    const sttLangs: Array<'en-US' | 'en-GB' | 'uz-UZ'> =
      language === 'en' ? ['en-US', 'en-GB'] : [langTag as 'uz-UZ'];
    let langIndex = 0;

    function tryListen(langCandidate: 'en-US' | 'en-GB' | 'uz-UZ') {
      return listen({
        lang: langCandidate,
        continuous: true,
        onInterim: (txt) => {
          setInterim(txt);
          resetSilenceTimer();
        },
        onResult: (txt) => {
          setStudentAnswer(txt);
          setInterim('');
          resetSilenceTimer();
        },
        onError: (err) => {
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setError(
              'Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.',
            );
            setPhase('ready');
            return;
          }
          if (err === 'language-not-supported' || err === 'network') {
            langIndex += 1;
            if (langIndex < sttLangs.length) {
              listenHandleRef.current = tryListen(sttLangs[langIndex]);
              return;
            }
          }
          if (err !== 'no-speech') setPhase('ready');
        },
        onEnd: () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        },
      });
    }

    try {
      const handle = tryListen(sttLangs[langIndex]);
      listenHandleRef.current = handle;
      setPhase('recording');
      // Arm silence timer immediately — if student says nothing, we still
      // exit recording after SILENCE_TIMEOUT_MS instead of hanging.
      resetSilenceTimer();
    } catch {
      setError("Brauzer ovozini boshlab bo'lmadi.");
    }
  }

  function stopMic() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try {
      listenHandleRef.current?.stop();
    } catch {
      /* ignore */
    }
    // Move to review if we captured anything; otherwise back to ready.
    setPhase((p) => {
      if (p !== 'recording') return p;
      const got = (studentAnswer || interim).trim();
      if (!got) return 'ready';
      // Promote interim to final if onResult hasn't fired yet.
      if (!studentAnswer && interim) setStudentAnswer(interim);
      return 'review';
    });
    setInterim('');
  }

  function retryRecording() {
    setStudentAnswer('');
    setInterim('');
    setPhase('ready');
  }

  // ── Submit answer ────────────────────────────────────────────────────────

  async function submitAnswer() {
    const text = studentAnswer.trim();
    if (!text || phase === 'submitting' || phase === 'finalizing') return;
    setPhase('submitting');
    setError(null);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<RespondResponse>(
        `/exams/oral/${permissionId}/respond`,
        { method: 'POST', body: JSON.stringify({ text }) },
        token,
      );
      const data = res.data;
      setStudentAnswer('');
      setAnsweredCount(data.answeredCount ?? answeredCount + 1);

      if (data.isFinal && typeof data.score === 'number') {
        // Backend has already finalized — show result screen.
        setFinalResult({
          sessionId: data.sessionId,
          score: data.score,
          passed: data.passed ?? false,
          analysis: data.analysis ?? null,
          message: data.message,
          isFinal: true,
        });
        // Speak the closing line so the student knows the exam ended.
        speakAi(data.message);
        return;
      }

      // Not yet final — next AI question.
      setAiQuestion(data.message);
      speakAi(data.message);
      // phase will move to 'listening-to-ai' via speakAi.onstart, then
      // 'ready' on onend.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yuborib boʻlmadi');
      setPhase('review');
    }
  }

  // ── Auto-finalize fallback (shouldn't fire under normal flow) ────────────
  // If the server ever leaves us with answeredCount === questionCount but
  // somehow didn't return isFinal (e.g., AI grader produced a malformed
  // JSON), kick the explicit /finalize endpoint to force a verdict.
  useEffect(() => {
    if (
      started &&
      !finalResult &&
      questionCount > 0 &&
      answeredCount >= questionCount &&
      phase === 'ready' &&
      !aiSpeaking
    ) {
      void forceFinalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, questionCount, phase, aiSpeaking, started, finalResult]);

  async function forceFinalize() {
    if (phase === 'finalizing' || finalResult) return;
    setPhase('finalizing');
    setError(null);
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
      setPhase('ready');
    }
  }

  // ── Pre-flight screen ────────────────────────────────────────────────────

  if (!started && !finalResult) {
    return (
      <div className="min-h-full bg-[#f7f4ef] flex items-center justify-center px-4 py-8">
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
                {language === 'uz' ? "o'zbek tilida" : 'inglizcha'} savol beradi
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Mic size={14} className="text-rose-600 shrink-0 mt-0.5" />
              <span>
                Mikrofon orqali ovoz bilan javob bering. 3 soniya jim tursangiz
                avtomatik to&apos;xtaydi.
              </span>
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
            {loading ? '...' : 'Imtihonni boshlash'}
          </Button>
          <p className="text-[11px] text-[#94a3b8] font-semibold">
            Boshlaganingizdan so&apos;ng AI savol berishni boshlaydi. Mikrofon
            ruxsatini bering.
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
      </div>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────

  if (finalResult) {
    const passed = finalResult.passed;
    const a = finalResult.analysis ?? {};
    return (
      <div className="min-h-full bg-[#f7f4ef] px-4 md:px-6 py-8 md:py-12">
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

  // ── Active exam — mic-only flow ──────────────────────────────────────────

  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedDispSec = elapsedSec % 60;
  const overTime = elapsedMin >= maxMinutes;
  // Question number to display: 1-indexed answered+1 while still asking,
  // or N while showing the final acknowledgment.
  const currentQuestionNumber = Math.min(answeredCount + 1, questionCount);

  return (
    <div className="min-h-full bg-[#f7f4ef] flex flex-col">
      {/* Header — title + progress + timer */}
      <div className="bg-[#0f172a] px-4 md:px-6 pt-4 pb-4 sticky top-0 z-30 border-b border-white/5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Volume2 size={18} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
              Savol {currentQuestionNumber} / {questionCount}
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
            <p className="text-[10px] font-bold text-[#94a3b8]">
              / {maxMinutes} min
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.round((answeredCount / Math.max(1, questionCount)) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Body — current question + mic */}
      <div className="flex-1 px-4 md:px-6 py-8 max-w-2xl mx-auto w-full flex flex-col items-center justify-center gap-6">
        {/* AI question card */}
        <div className="w-full bg-white rounded-3xl border-[1.5px] border-violet-200 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
              <Volume2 size={14} className="text-violet-600" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-700">
              {aiSpeaking ? 'AI gapiryapti...' : 'AI savoli'}
            </p>
          </div>
          <p className="text-base md:text-lg font-bold text-[#0f172a] leading-relaxed">
            {aiQuestion || '...'}
          </p>
        </div>

        {/* Phase-specific UI */}
        {phase === 'submitting' || phase === 'finalizing' ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-5 py-4 inline-flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse" />
            <span
              className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse"
              style={{ animationDelay: '120ms' }}
            />
            <span
              className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse"
              style={{ animationDelay: '240ms' }}
            />
            <span className="text-xs font-bold text-[#64748b] ml-1">
              {phase === 'finalizing' ? 'Imtihon yakunlanmoqda...' : "AI o'ylayapti..."}
            </span>
          </div>
        ) : phase === 'review' ? (
          <div className="w-full space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 mb-1">
                Sizning javobingiz
              </p>
              <p className="text-base font-bold text-[#0f172a] leading-relaxed">
                {studentAnswer}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={retryRecording}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-white border-2 border-[#ede9e1] hover:border-[#0f172a] text-[#0f172a] font-bold text-sm rounded-2xl py-3 min-h-[48px] transition-colors"
              >
                <RotateCcw size={16} />
                Qayta yozish
              </button>
              <button
                type="button"
                onClick={submitAnswer}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-2xl py-3 min-h-[48px] transition-colors"
              >
                <Send size={16} />
                Yuborish
              </button>
            </div>
          </div>
        ) : phase === 'recording' ? (
          <div className="w-full flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={stopMic}
              aria-label="Yozishni to'xtatish"
              className="w-24 h-24 rounded-full bg-rose-600 hover:bg-rose-700 text-white motion-safe:animate-pulse flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(225,29,72,0.5)] transition-colors"
            >
              <Square size={32} fill="currentColor" />
            </button>
            <div className="text-center">
              <p className="text-sm font-extrabold text-rose-700">
                Eshityapman...
              </p>
              <p className="text-[11px] text-[#64748b] font-semibold mt-1">
                Gapirib bo&apos;lganingizda tugmani bosing yoki 3 soniya jim turing
              </p>
            </div>
            {(studentAnswer || interim) && (
              <div className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] max-h-32 overflow-y-auto">
                <span className="font-semibold">{studentAnswer}</span>
                {interim && (
                  <span className="text-[#94a3b8] italic"> {interim}</span>
                )}
              </div>
            )}
          </div>
        ) : phase === 'ready' ? (
          <div className="w-full flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={startMic}
              disabled={!sttSupported}
              aria-label="Javob berishni boshlash"
              className="w-24 h-24 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(124,58,237,0.6)] transition-colors"
            >
              <Mic size={36} />
            </button>
            <p className="text-sm font-bold text-[#64748b]">
              Javob berish uchun mikrofon tugmasini bosing
            </p>
            {!sttSupported && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-amber-800 text-center">
                Brauzeringiz mikrofonni qo&apos;llab-quvvatlamaydi. Chrome yoki
                Edge ishlatib ko&apos;ring.
              </div>
            )}
          </div>
        ) : (
          // listening-to-ai — wait for TTS to finish
          <div className="text-center">
            <p className="text-sm font-bold text-violet-700">
              AI savolni gapirayapti...
            </p>
            <p className="text-[11px] text-[#64748b] font-semibold mt-1">
              Tugaganidan keyin mikrofon tugmasi paydo bo&apos;ladi
            </p>
          </div>
        )}

        {error && (
          <div className="w-full bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-800 leading-snug">
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
