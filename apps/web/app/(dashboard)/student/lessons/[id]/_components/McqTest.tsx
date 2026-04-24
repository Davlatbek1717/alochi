'use client';
import { useState } from 'react';

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
      <div className="flex justify-between text-sm text-gray-500">
        <span>Savol {current + 1} / {questions.length}</span>
        {wrongs > 0 && <span className="text-red-500">{wrongs} ta xato</span>}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="font-semibold text-lg mb-4">{q.text}</p>
        <div className="space-y-2">
          {q.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => !showResult && handleAnswer(idx)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                showResult && idx === q.correct ? 'border-green-500 bg-green-50' :
                showResult && idx === selected && idx !== q.correct ? 'border-red-500 bg-red-50' :
                'border-gray-200 hover:border-indigo-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
