'use client';
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiTutorProps {
  lessonContext: string;
  onCompleted: () => void;
}

export function AiTutor({ lessonContext, onCompleted }: AiTutorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [readyError, setReadyError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;

    const historySnapshot = messages;
    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setQuestionCount((c) => c + 1);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/tutor/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_context: lessonContext,
          question,
          conversation_history: historySnapshot.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "⚠️ AI hozir band, keyinroq urinib ko'ring" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleReady() {
    if (questionCount === 0) {
      setReadyError('Kamida 1 ta savol bering');
      return;
    }
    onCompleted();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm flex flex-col h-96">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <div>
          <p className="font-semibold text-sm">AI Tutor</p>
          <p className="text-xs text-gray-400">{questionCount} ta savol berildi</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm pt-8">
            <p className="text-3xl mb-2">💬</p>
            <p>Dars bo&apos;yicha savolingizni bering!</p>
            <p className="text-xs mt-1">Masalan: &quot;do va does farqi nima?&quot;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 rounded-xl text-sm text-gray-500">
              AI yozmoqda...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendQuestion(input)}
            placeholder="Savolingizni yozing..."
            aria-label="AI tutorga savol yozing"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={loading || !input.trim()}
            aria-label="Savol yuborish"
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            ↑
          </button>
        </div>
        {readyError && <p className="text-red-500 text-xs">{readyError}</p>}
        <button
          onClick={handleReady}
          className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
        >
          ✅ Tayyor — Keyingi bosqich
        </button>
      </div>
    </div>
  );
}
