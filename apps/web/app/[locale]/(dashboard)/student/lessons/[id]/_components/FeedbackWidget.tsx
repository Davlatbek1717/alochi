'use client';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';

interface Props {
  lessonId: string;
  onDone?: () => void;
}

const RATINGS = [
  { value: 1, emoji: '😕', label: 'Qiyin' },
  { value: 2, emoji: '😐', label: "O'rtacha" },
  { value: 3, emoji: '😊', label: 'Tushunarli' },
];

export function FeedbackWidget({ lessonId, onDone }: Props) {
  const [submitted, setSubmitted] = useState(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(`feedback_${lessonId}`) : false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function submit(rating: number) {
    setSubmitting(true);
    setError(false);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest('/content-quality/feedback', {
        method: 'POST',
        body: JSON.stringify({ lessonId, rating }),
      }, token);
      localStorage.setItem(`feedback_${lessonId}`, '1');
      setSubmitted(true);
      onDone?.();
    } catch {
      setError(true);
      setSubmitting(false);
      return;
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return null;

  return (
    <div className="mt-4 p-4 bg-white border-[1.5px] border-[#ede9e1] rounded-2xl shadow-sm">
      <p className="text-sm font-extrabold text-[#0f172a] mb-3 text-center">
        Bu dars qanday bo&apos;ldi?
      </p>
      <div className="flex justify-center gap-2 sm:gap-4">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            onClick={() => submit(r.value)}
            disabled={submitting}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-[#fffaf0] transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <span className="text-3xl">{r.emoji}</span>
            <span className="text-xs font-bold text-[#64748b]">{r.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-rose-500 font-bold text-center mt-2">
          Yuborishda xato. Qaytadan urinib ko&apos;ring.
        </p>
      )}
    </div>
  );
}
