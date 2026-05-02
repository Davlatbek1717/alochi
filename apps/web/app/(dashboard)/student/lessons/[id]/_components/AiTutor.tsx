'use client';
import { useState, useRef, useEffect } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { getSpeechCapabilities, listen } from '@/lib/speech';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiTutorProps {
  lessonContext: string;
  onCompleted: () => void;
}

const SUGGESTIONS = [
  "Bu so'zning ma'nosi nima?",
  'Yana misol bera olasizmi?',
  "Tushunmadim, qayta tushuntiring",
];

const MAX_QUESTIONS = 3;

/**
 * Pass 5 — Duolingo-grade AI tutor:
 *   - Aloqush mascot in header (idle expression) + "1/3 savol" counter chip
 *   - Cream bot bubbles with green left-border, primary-green user bubbles
 *   - 3 suggestion chips above input (tap → fills input)
 *   - Circular green Send button; "Tayyor" disabled until first question asked
 *   - On Tayyor: xp chime + onCompleted
 */
export function AiTutor({ lessonContext, onCompleted }: AiTutorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [readyError, setReadyError] = useState('');
  // Browser-STT availability + live recording state. Computed once on
  // mount so SSR matches the initial client render.
  const [sttAvailable, setSttAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const listenHandleRef = useRef<{ stop: () => void } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setSttAvailable(getSpeechCapabilities().stt);
    return () => {
      // Always stop any in-flight recognition when the tutor unmounts.
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  /**
   * Toggle browser STT. While listening:
   *  - interim transcripts pipe into the input live (acts as a caption).
   *  - on final result, the recognizer auto-stops; we keep the text in
   *    the input so the student can edit before sending.
   * If unsupported (Firefox / settings off), the button is hidden upstream.
   */
  function toggleVoiceInput() {
    if (listening) {
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    try {
      const handle = listen({
        lang: 'en-US',
        continuous: true,
        onInterim: (txt) => setInput(txt),
        onResult: (txt) => {
          setInput(txt);
          setListening(false);
        },
        onError: (err) => {
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setReadyError('Mikrofon ruxsati berilmadi.');
          } else if (err === 'no-speech') {
            setReadyError("Ovoz eshitilmadi — qayta urinib ko'ring.");
          }
          setListening(false);
        },
        onEnd: () => setListening(false),
      });
      listenHandleRef.current = handle;
      setListening(true);
      setReadyError('');
    } catch {
      setReadyError("Brauzer ovozini boshlab bo'lmadi.");
      setListening(false);
    }
  }

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;

    const historySnapshot = messages;
    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setQuestionCount((c) => c + 1);
    setReadyError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/qa/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonContext,
          question,
          history: historySnapshot.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Support both wrapped { success, data } and legacy raw response.
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      setMessages((prev) => [...prev, { role: 'assistant', content: data?.answer ?? '' }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "AI hozir band, keyinroq urinib ko'ring" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleReady() {
    if (questionCount === 0) {
      setReadyError("Kamida 1 ta savol bering");
      return;
    }
    playSound('xp');
    onCompleted();
  }

  const counter = `${Math.min(questionCount, MAX_QUESTIONS)}/${MAX_QUESTIONS} savol`;

  return (
    <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] flex flex-col h-[28rem] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#f3eedf] flex items-center gap-3 bg-[#fffaf0]">
        <div className="shrink-0">
          <Mascot expression="idle" size={56} animated />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-extrabold text-sm text-[#3c3c3c] truncate"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Aloqush sizga yordam beradi
          </p>
          <p className="text-xs font-bold text-[#777]">Dars bo&apos;yicha savol bering</p>
        </div>
        <span
          className="text-[10px] font-extrabold text-[#7a5e2c] bg-[#fef3c7] border border-[#fde68a] px-2 py-1 rounded-full shrink-0"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {counter}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-[#777] text-sm pt-6 space-y-2">
            <p
              className="font-extrabold text-[#3c3c3c]"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              Dars bo&apos;yicha savolingizni bering!
            </p>
            <p className="text-xs font-bold">Pastdagi tavsiyalardan birini tanlang yoki o&apos;zingiznikini yozing.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 text-sm font-semibold leading-snug ${
                msg.role === 'user'
                  ? 'bg-[#58cc02] text-white rounded-2xl rounded-tr-md'
                  : 'bg-[#fffaf0] text-[#3c3c3c] border-l-4 border-[#58cc02] rounded-2xl rounded-tl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#fffaf0] border-l-4 border-[#58cc02] px-4 py-2.5 rounded-2xl rounded-tl-md text-sm font-semibold text-[#777] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#58cc02] motion-safe:[animation:pop_0.9s_ease-in-out_infinite]" />
              <span
                className="w-2 h-2 rounded-full bg-[#58cc02] motion-safe:[animation:pop_0.9s_ease-in-out_infinite]"
                style={{ animationDelay: '120ms' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-[#58cc02] motion-safe:[animation:pop_0.9s_ease-in-out_infinite]"
                style={{ animationDelay: '240ms' }}
              />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-[#f3eedf]">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="text-xs font-extrabold text-[#7a5e2c] bg-[#fef3c7] hover:bg-[#fde68a] border border-[#fde68a] px-2.5 py-1.5 rounded-full transition-colors"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input + send */}
      <div className="border-t border-[#f3eedf] p-3 space-y-2 bg-white">
        <div className="flex gap-2 items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendQuestion(input)}
            placeholder={
              listening ? 'Tinglanmoqda...' : 'Savolingizni yozing...'
            }
            aria-label="AI tutorga savol yozing"
            className="flex-1 border-[1.5px] border-[#e8e0d0] rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#3c3c3c] focus:outline-none focus:border-[#58cc02]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          />
          {/* Voice input — only rendered when SpeechRecognition is supported
              AND the user hasn't disabled "Brauzer ovozi" in settings. */}
          {sttAvailable && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={loading}
              aria-label={listening ? "Yozishni to'xtatish" : 'Ovozli savol'}
              title={listening ? "Yozishni to'xtatish" : 'Ovozli savol'}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-white border-b-[3px] active:translate-y-[1px] active:border-b-[1px] transition-all duration-150 disabled:opacity-60 ${
                listening
                  ? 'bg-[#ef4444] border-[#b91c1c] motion-safe:[animation:pulse-ring_1.2s_ease-out_infinite]'
                  : 'bg-[#fbbf24] border-[#d97706]'
              }`}
            >
              {listening ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => sendQuestion(input)}
            disabled={loading || !input.trim()}
            aria-label="Savol yuborish"
            className="w-11 h-11 rounded-full flex items-center justify-center bg-[#58cc02] text-white border-b-[3px] border-[#46a302] active:translate-y-[1px] active:border-b-[1px] disabled:bg-[#e8e0d0] disabled:border-[#cbbf9c] disabled:text-[#a0a0a0] transition-all duration-150"
          >
            <Send size={18} />
          </button>
        </div>
        {readyError && (
          <p
            className="text-[#ef4444] text-xs font-extrabold"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {readyError}
          </p>
        )}
        <Button
          variant="duo"
          size="md"
          fullWidth
          disabled={questionCount < 1}
          onClick={handleReady}
        >
          Tayyor — Keyingi bosqich
        </Button>
      </div>
    </div>
  );
}
