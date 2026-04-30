'use client';
import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface McqQuestion {
  text: string;
  options: string[];
  correct: number;
}

interface McqTestProps {
  questions: McqQuestion[];
  onPassed: () => void;
  onFailed: () => void;
}

export function McqTest({ questions, onPassed, onFailed }: McqTestProps) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [wrongs, setWrongs] = useState(0);

  const q = questions[current];

  function handleAnswer(idx: number) {
    setSelected(idx);
    setShowResult(true);

    const wrong = idx !== q.correct;
    if (wrong) {
      setWrongs((w) => w + 1);
    }

    setTimeout(() => {
      if (current + 1 < questions.length) {
        setCurrent((c) => c + 1);
        setSelected(null);
        setShowResult(false);
      } else {
        const totalWrongs = wrongs + (wrong ? 1 : 0);
        if (totalWrongs === 0) {
          onPassed();
        } else {
          onFailed();
        }
      }
    }, 1200);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm">
        <span className="text-[#94a3b8] font-medium">
          Savol {current + 1} / {questions.length}
        </span>
        {wrongs > 0 && (
          <span className="flex items-center gap-1 text-rose-500 font-semibold text-xs bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
            <XCircle size={12} /> {wrongs} ta xato
          </span>
        )}
      </div>

      <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 space-y-4">
        <p className="font-semibold text-[#0f172a] text-base leading-snug">{q.text}</p>
        <div className="space-y-2">
          {q.options.map((opt, idx) => {
            const isSelected = selected === idx;
            const isCorrect = idx === q.correct;
            let optStyle = 'border-[#ede9e1] bg-[#f7f4ef] text-[#0f172a] hover:border-[#0f172a]/40 hover:bg-white';
            if (showResult && isCorrect) {
              optStyle = 'border-emerald-400 bg-emerald-50 text-emerald-700';
            } else if (showResult && isSelected && !isCorrect) {
              optStyle = 'border-rose-400 bg-rose-50 text-rose-700';
            }

            return (
              <button
                key={idx}
                onClick={() => !showResult && handleAnswer(idx)}
                disabled={showResult}
                className={`w-full text-left px-4 py-3 rounded-xl border-[1.5px] text-sm font-medium transition-all duration-150 flex items-center gap-3 ${optStyle}`}
              >
                <span className="font-mono text-xs opacity-50 shrink-0">{String.fromCharCode(65 + idx)}.</span>
                <span className="flex-1">{opt}</span>
                {showResult && isCorrect && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                {showResult && isSelected && !isCorrect && <XCircle size={16} className="text-rose-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i < current ? 'bg-[#0d9488]' :
              i === current ? 'bg-[#f59e0b] scale-125' :
              'bg-[#ede9e1]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
