'use client';

import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, Trophy, RotateCcw, ArrowRight } from 'lucide-react';
import { McqTest } from './McqTest';
import { WordOrderTest } from './WordOrderTest';
import { TranslateInput } from './TranslateInput';
import { FillBlank } from './FillBlank';
import { OrderSentences } from './OrderSentences';
import { ListenPick } from './ListenPick';
import { ListenType } from './ListenType';
import { SpellingDrill } from './SpellingDrill';
import { MatchPairs } from './MatchPairs';
import type {
  TranslateConfig,
  FillBlankConfig,
  OrderSentencesConfig,
  ListenPickConfig,
  ListenTypeConfig,
  SpellingConfig,
  MatchPairsConfig,
} from './exercise-types';

// ─── Types ────────────────────────────────────────────────────────────────────

type LessonComponent = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

type PracticeQuestion =
  | { kind: 'mcq'; questions: { text: string; options: string[]; correct: number }[] }
  | { kind: 'word_order'; sentences: { words: string[]; correct: string }[] }
  | { kind: 'translate'; config: TranslateConfig }
  | { kind: 'fill_blank'; config: FillBlankConfig }
  | { kind: 'order_sentences'; config: OrderSentencesConfig }
  | { kind: 'listen_pick'; config: ListenPickConfig }
  | { kind: 'listen_type'; config: ListenTypeConfig }
  | { kind: 'spelling'; config: SpellingConfig }
  | { kind: 'match_pairs'; config: MatchPairsConfig };

interface PracticeExamProps {
  lessonId: string;
  componentsData: LessonComponent[];
  componentFlags: { mcq?: boolean; word_order?: boolean };
  onComplete: (score: number) => void;
  onExit: () => void;
}

// ─── Question builder ─────────────────────────────────────────────────────────

function buildQuestions(
  data: LessonComponent[],
  flags: { mcq?: boolean; word_order?: boolean },
): PracticeQuestion[] {
  const qs: PracticeQuestion[] = [];

  // MCQ — aggregate or flat shape
  if (flags.mcq) {
    const mcqComponents = data.filter((c) => c.type === 'mcq');
    if (mcqComponents.length > 0) {
      const questions: { text: string; options: string[]; correct: number }[] = [];
      for (const c of mcqComponents) {
        const cfg = c.config as {
          questions?: Array<{ text?: string; options?: string[]; correct?: number }>;
          question?: string;
          options?: string[];
          correctIndex?: number;
        };
        if (Array.isArray(cfg?.questions)) {
          for (const q of cfg.questions) {
            if (q?.text && Array.isArray(q.options) && q.options.length > 0) {
              questions.push({ text: q.text, options: q.options, correct: q.correct ?? 0 });
            }
          }
        } else if (cfg?.question && Array.isArray(cfg.options)) {
          questions.push({
            text: cfg.question,
            options: cfg.options,
            correct: cfg.correctIndex ?? 0,
          });
        }
      }
      if (questions.length > 0) qs.push({ kind: 'mcq', questions });
    }
  }

  // Word order — aggregate or flat shape
  if (flags.word_order) {
    const woComponents = data.filter((c) => c.type === 'word_order');
    if (woComponents.length > 0) {
      const sentences: { words: string[]; correct: string }[] = [];
      for (const c of woComponents) {
        const cfg = c.config as {
          sentences?: Array<{ words?: string[]; correct?: string }>;
          words?: string[];
          correct?: string;
        };
        if (Array.isArray(cfg?.sentences)) {
          for (const s of cfg.sentences) {
            if (Array.isArray(s?.words) && s.correct) {
              sentences.push({ words: s.words, correct: s.correct });
            }
          }
        } else if (Array.isArray(cfg?.words) && cfg?.correct) {
          sentences.push({ words: cfg.words, correct: cfg.correct });
        }
      }
      if (sentences.length > 0) qs.push({ kind: 'word_order', sentences });
    }
  }

  // Pass-2+ types — one question per component
  for (const c of data) {
    if (c.type === 'translate' && c.config) {
      const cfg = c.config as unknown as TranslateConfig;
      if (cfg?.sourceText && cfg?.correctAnswer) qs.push({ kind: 'translate', config: cfg });
    } else if (c.type === 'fill_blank' && c.config) {
      const cfg = c.config as unknown as FillBlankConfig;
      if (cfg?.sentence?.includes('___') && cfg?.blank) qs.push({ kind: 'fill_blank', config: cfg });
    } else if (c.type === 'order_sentences' && c.config) {
      const cfg = c.config as unknown as OrderSentencesConfig;
      if (Array.isArray(cfg?.sentences) && cfg.sentences.length >= 2)
        qs.push({ kind: 'order_sentences', config: cfg });
    } else if (c.type === 'listen_pick' && c.config) {
      const cfg = c.config as unknown as ListenPickConfig;
      if (cfg?.text && Array.isArray(cfg.options) && cfg.options.length >= 2)
        qs.push({ kind: 'listen_pick', config: cfg });
    } else if (c.type === 'listen_type' && c.config) {
      const cfg = c.config as unknown as ListenTypeConfig;
      if (cfg?.text) qs.push({ kind: 'listen_type', config: cfg });
    } else if (c.type === 'spelling' && c.config) {
      const cfg = c.config as unknown as SpellingConfig;
      if (cfg?.word && cfg.word.length <= 30) qs.push({ kind: 'spelling', config: cfg });
    } else if (c.type === 'match_pairs' && c.config) {
      const cfg = c.config as unknown as MatchPairsConfig;
      if (Array.isArray(cfg?.pairs) && cfg.pairs.length >= 2)
        qs.push({ kind: 'match_pairs', config: cfg });
    }
  }

  return qs;
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultScreen({
  score,
  correct,
  total,
  passed,
  submitting,
  submitError,
  onRetry,
  onContinue,
}: {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  submitting: boolean;
  submitError: boolean;
  onRetry: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="sp-theme min-h-full flex flex-col items-center justify-center p-4">
      <div
        className="w-full max-w-sm space-y-5"
        style={{
          background: 'var(--bone)',
          border: `2px solid ${passed ? 'var(--leaf)' : 'var(--ember)'}`,
          borderRadius: 'var(--r-4)',
          padding: '2rem 1.5rem',
        }}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: passed ? 'var(--leaf-soft)' : 'var(--ember-soft)' }}
          >
            {passed ? (
              <Trophy size={40} style={{ color: 'var(--leaf)' }} />
            ) : (
              <XCircle size={40} style={{ color: 'var(--ember)' }} />
            )}
          </div>
        </div>

        {/* Score */}
        <div className="text-center space-y-1">
          <p
            className="sp-display text-5xl font-black"
            style={{ color: passed ? 'var(--leaf)' : 'var(--ember)' }}
          >
            {score}%
          </p>
          <p className="sp-display text-base font-bold" style={{ color: 'var(--ink)' }}>
            {passed ? "🎉 O'tdingiz!" : "Yana o'rganish kerak"}
          </p>
        </div>

        {/* Stats */}
        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
              Jami savollar
            </span>
            <span className="font-bold" style={{ color: 'var(--ink)' }}>
              {total}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--leaf)' }}>
              <CheckCircle2 size={14} /> To&apos;g&apos;ri
            </span>
            <span className="font-bold" style={{ color: 'var(--leaf)' }}>
              {correct}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ember)' }}>
              <XCircle size={14} /> Noto&apos;g&apos;ri
            </span>
            <span className="font-bold" style={{ color: 'var(--ember)' }}>
              {total - correct}
            </span>
          </div>
        </div>

        {/* Verdict message */}
        <p
          className="text-center text-sm font-semibold"
          style={{ color: 'var(--ink-2)' }}
        >
          {passed
            ? 'Mentorga ayting — imtihonga tayyorsiz!'
            : "Darsni yana bir marta o'tib, qayta urinib ko'ring."}
        </p>

        {submitError && (
          <p className="text-center text-xs font-semibold" style={{ color: 'var(--ember)' }}>
            Natijani saqlashda xato. Davom etishingiz mumkin.
          </p>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {!passed && (
            <button
              onClick={onRetry}
              className="sp-display w-full py-3 min-h-[44px] flex items-center justify-center gap-2 font-bold active:translate-y-[2px] transition-transform"
              style={{
                background: 'var(--ember)',
                color: 'var(--bone)',
                border: '2px solid var(--ember-deep)',
                borderRadius: 'var(--r-3)',
                boxShadow: '0 4px 0 var(--ember-deep)',
              }}
            >
              <RotateCcw size={16} />
              Qayta urinish
            </button>
          )}
          <button
            disabled={submitting}
            onClick={onContinue}
            className="sp-display w-full py-3 min-h-[44px] flex items-center justify-center gap-2 font-bold active:translate-y-[2px] transition-transform disabled:opacity-60"
            style={{
              background: passed ? 'var(--leaf)' : 'var(--paper)',
              color: passed ? 'var(--bone)' : 'var(--ink-2)',
              border: `2px solid ${passed ? 'var(--leaf-deep)' : 'var(--line-2)'}`,
              borderRadius: 'var(--r-3)',
              boxShadow: passed ? '0 4px 0 var(--leaf-deep)' : 'none',
            }}
          >
            {submitting ? 'Saqlanmoqda...' : passed ? (
              <>Darslar ro&apos;yxati <ArrowRight size={16} /></>
            ) : "Darslar ro'yxati"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PracticeExam({
  lessonId,
  componentsData,
  componentFlags,
  onComplete,
  onExit,
}: PracticeExamProps) {
  const questions = useMemo(
    () => buildQuestions(componentsData, componentFlags),
    [componentsData, componentFlags],
  );

  const [current, setCurrent] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  // cycleKey forces exercise components to fully remount when we advance.
  const [cycleKey, setCycleKey] = useState(0);
  const [phase, setPhase] = useState<'exam' | 'result'>('exam');
  const [finalScore, setFinalScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const total = questions.length;

  function advance(correct: boolean) {
    const newCorrect = correctCount + (correct ? 1 : 0);
    const nextIdx = current + 1;

    if (nextIdx >= total) {
      const score = total > 0 ? Math.round((newCorrect / total) * 100) : 0;
      setFinalScore(score);
      setCorrectCount(newCorrect);
      setPhase('result');
      submitScore(score);
    } else {
      setCorrectCount(newCorrect);
      setCurrent(nextIdx);
      setCycleKey((k) => k + 1);
    }
  }

  async function submitScore(score: number) {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/progress/${lessonId}/practice-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score }),
      });
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
      onComplete(score);
    }
  }

  if (total === 0) {
    return (
      <div className="sp-theme min-h-full flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-xs">
          <p className="sp-display font-bold" style={{ color: 'var(--ink)' }}>
            Bu darsda mashq savollari yo&apos;q
          </p>
          <button
            onClick={onExit}
            className="sp-display px-6 py-3 font-bold"
            style={{
              background: 'var(--leaf)',
              color: 'var(--bone)',
              border: '2px solid var(--leaf-deep)',
              borderRadius: 'var(--r-3)',
              boxShadow: '0 4px 0 var(--leaf-deep)',
            }}
          >
            Ortga
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];

  if (phase === 'result') {
    return (
      <ResultScreen
        score={finalScore}
        correct={correctCount}
        total={total}
        passed={finalScore >= 70}
        submitting={submitting}
        submitError={submitError}
        onRetry={() => {
          setCurrent(0);
          setCorrectCount(0);
          setCycleKey((k) => k + 1);
          setPhase('exam');
        }}
        onContinue={onExit}
      />
    );
  }

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="sp-theme min-h-full flex flex-col">
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3 sticky top-0 z-10"
        style={{ background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="sp-display text-sm font-bold" style={{ color: 'var(--ink-2)' }}>
            Mashq imtihon
          </span>
          <span className="sp-display text-sm font-bold" style={{ color: 'var(--ink-2)' }}>
            {current + 1} / {total}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: 'var(--line)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: 'var(--leaf)' }}
          />
        </div>
      </div>

      {/* Exercise */}
      <div className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        <ExerciseStep key={cycleKey} q={q} onPassed={() => advance(true)} onFailed={() => advance(false)} />
      </div>
    </div>
  );
}

// ─── Exercise step dispatcher ─────────────────────────────────────────────────

function ExerciseStep({
  q,
  onPassed,
  onFailed,
}: {
  q: PracticeQuestion;
  onPassed: () => void;
  onFailed: () => void;
}) {
  switch (q.kind) {
    case 'mcq':
      return <McqTest questions={q.questions} onPassed={onPassed} onFailed={onFailed} />;
    case 'word_order':
      return <WordOrderTest sentences={q.sentences} onPassed={onPassed} onFailed={onFailed} />;
    case 'translate':
      return <TranslateInput config={q.config} onPassed={onPassed} onFailed={onFailed} />;
    case 'fill_blank':
      return <FillBlank config={q.config} onPassed={onPassed} onFailed={onFailed} />;
    case 'order_sentences':
      return <OrderSentences config={q.config} onPassed={onPassed} onFailed={onFailed} />;
    case 'listen_pick':
      return <ListenPick config={q.config} onPassed={onPassed} onFailed={onFailed} />;
    case 'listen_type':
      return <ListenType config={q.config} onPassed={onPassed} onFailed={onFailed} />;
    case 'spelling':
      return <SpellingDrill config={q.config} onPassed={onPassed} onFailed={onFailed} />;
    case 'match_pairs':
      return <MatchPairs config={q.config} onPassed={onPassed} onFailed={onFailed} />;
    default:
      return null;
  }
}
