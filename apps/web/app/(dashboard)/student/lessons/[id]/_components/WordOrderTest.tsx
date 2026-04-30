'use client';
import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';

interface WordOrderTestProps {
  sentences: { words: string[]; correct: string }[];
  onPassed: () => void;
  onFailed: () => void;
}

export function WordOrderTest({ sentences, onPassed, onFailed }: WordOrderTestProps) {
  const [current, setCurrent] = useState(0);
  const [arranged, setArranged] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<string[]>(() => [...sentences[0].words]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const sentence = sentences[current];

  function addWord(word: string, idx: number) {
    setArranged((prev) => [...prev, word]);
    setRemaining((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeWord(word: string, idx: number) {
    setRemaining((prev) => [...prev, word]);
    setArranged((prev) => prev.filter((_, i) => i !== idx));
  }

  function checkAnswer() {
    const answer = arranged.join(' ');
    const correct = answer === sentence.correct;
    setIsCorrect(correct);
    setShowResult(true);

    setTimeout(() => {
      if (!correct) {
        onFailed();
        return;
      }
      if (current + 1 < sentences.length) {
        const nextIdx = current + 1;
        setCurrent(nextIdx);
        setArranged([]);
        setRemaining([...sentences[nextIdx].words]);
        setShowResult(false);
      } else {
        onPassed();
      }
    }, 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm">
        <span className="text-[#94a3b8] font-medium">
          Savol {current + 1} / {sentences.length}
        </span>
        <span className="text-[#94a3b8] text-xs">
          {arranged.length} / {sentence.words.length} so&apos;z
        </span>
      </div>

      {/* Answer area */}
      <div className={`min-h-14 rounded-[18px] p-3 border-[1.5px] flex flex-wrap gap-2 items-start transition-colors duration-200 ${
        showResult && isCorrect ? 'border-emerald-400 bg-emerald-50' :
        showResult && !isCorrect ? 'border-rose-400 bg-rose-50' :
        arranged.length > 0 ? 'border-indigo-300 bg-indigo-50' : 'border-[#ede9e1] bg-[#f7f4ef]'
      }`}>
        {arranged.map((w, i) => (
          <button
            key={i}
            onClick={() => !showResult && removeWord(w, i)}
            disabled={showResult}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:cursor-default transition-colors"
          >
            {w}
          </button>
        ))}
        {arranged.length === 0 && (
          <span className="text-[#94a3b8] text-sm px-1">So&apos;zlarni bosib tartibga soling...</span>
        )}
      </div>

      {/* Word chips */}
      <div className="flex flex-wrap gap-2">
        {remaining.map((w, i) => (
          <button
            key={i}
            onClick={() => !showResult && addWord(w, i)}
            disabled={showResult}
            className="bg-white border-[1.5px] border-[#ede9e1] px-3 py-1.5 rounded-lg text-sm font-medium text-[#0f172a] hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-default transition-all duration-150"
          >
            {w}
          </button>
        ))}
      </div>

      {!showResult && arranged.length > 0 && (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="!bg-indigo-600 hover:!bg-indigo-700 !border-indigo-600 !rounded-xl"
          onClick={checkAnswer}
        >
          Tekshirish
        </Button>
      )}

      {showResult && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 font-semibold text-sm ${
          isCorrect
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {isCorrect
            ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            : <XCircle size={18} className="text-rose-500 shrink-0" />}
          {isCorrect ? "To'g'ri!" : "Xato — qaytadan boshlanadi"}
        </div>
      )}

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center">
        {sentences.map((_, i) => (
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
