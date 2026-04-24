'use client';
import { useState } from 'react';

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
      <p className="text-sm text-gray-500">Savol {current + 1} / {sentences.length}</p>

      <div className="min-h-12 bg-indigo-50 rounded-xl p-3 flex flex-wrap gap-2">
        {arranged.map((w, i) => (
          <button
            key={i}
            onClick={() => !showResult && removeWord(w, i)}
            className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm"
          >
            {w}
          </button>
        ))}
        {arranged.length === 0 && (
          <span className="text-gray-400 text-sm">So&apos;zlarni bosib tartibga soling...</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {remaining.map((w, i) => (
          <button
            key={i}
            onClick={() => !showResult && addWord(w, i)}
            className="bg-white border-2 border-gray-200 px-3 py-1 rounded-lg text-sm hover:border-indigo-400"
          >
            {w}
          </button>
        ))}
      </div>

      {!showResult && arranged.length > 0 && (
        <button
          onClick={checkAnswer}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
        >
          Tekshirish
        </button>
      )}

      {showResult && (
        <div className={`p-3 rounded-xl text-center font-medium ${
          isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isCorrect ? '✅ To\'g\'ri!' : '❌ Xato — qaytadan boshlanadi'}
        </div>
      )}
    </div>
  );
}
