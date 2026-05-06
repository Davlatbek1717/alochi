'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { COMPONENT_LABELS, type ConfigComponent } from './ComponentsList';

/**
 * Pass 5 — Component configurator forms.
 *
 * A switch over `type` rendering a per-type form. Each form maintains its
 * local draft state seeded from `initialConfig` when editing an existing
 * row. On Saqlash we validate required fields and bubble the resulting
 * config object up via `onSubmit`. The parent (page.tsx) then calls
 * POST/PATCH `/lessons/:lessonId/components`.
 *
 * The forms intentionally stick close to the runtime config shapes in
 * `apps/web/app/(dashboard)/student/lessons/[id]/_components/exercise-types.ts`
 * so what you save here renders exactly as the student sees it. The legacy
 * `mcq` and `word_order` types use the multi-question shapes that the
 * existing aggregate POST endpoints expect (questions[] / sentences[]).
 *
 * `vocabulary` and `ai_tutor` are covered by the existing dedicated
 * editors elsewhere (vocabulary table, lesson `components.ai_tutor` flag),
 * so this configurator surfaces a hint instead of duplicating those.
 */

/**
 * NOTE: 'vocabulary' was historically a configurable type but never had a
 * working schema, settings page, or runtime — only a dead-end "go to
 * Sozlamalar → Lug'at" hint pointing at a page that doesn't exist. It's
 * dropped from the configurator UI here so admins can't pick it. The
 * literal still exists in the API DTO `COMPONENT_TYPES` so any rows
 * already stored in the database keep deserializing.
 */
export type ComponentTypeKey =
  | 'mcq'
  | 'word_order'
  | 'translate'
  | 'listen_pick'
  | 'listen_type'
  | 'match_pairs'
  | 'pick_picture'
  | 'fill_blank'
  | 'spelling'
  | 'order_sentences'
  | 'speak_sentence'
  | 'speak_words';

export const ALL_TYPES: ComponentTypeKey[] = [
  'mcq',
  'word_order',
  'translate',
  'listen_pick',
  'listen_type',
  'match_pairs',
  'pick_picture',
  'fill_blank',
  'spelling',
  'order_sentences',
  'speak_sentence',
  'speak_words',
];

interface Props {
  type: ComponentTypeKey;
  initialConfig?: Record<string, unknown>;
  onSubmit: (config: Record<string, unknown>) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
}

export function ComponentConfigurator({
  type,
  initialConfig,
  onSubmit,
  onCancel,
  saving,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b]">
        {COMPONENT_LABELS[type]}
      </p>
      <FormForType
        type={type}
        initialConfig={initialConfig ?? {}}
        onSubmit={onSubmit}
        onCancel={onCancel}
        saving={saving}
      />
    </div>
  );
}

// ─── Per-type forms ─────────────────────────────────────────────────────────

interface FormProps {
  type: ComponentTypeKey;
  initialConfig: Record<string, unknown>;
  onSubmit: (config: Record<string, unknown>) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
}

function FormForType(props: FormProps) {
  switch (props.type) {
    case 'mcq':
      return <McqForm {...props} />;
    case 'word_order':
      return <WordOrderForm {...props} />;
    case 'translate':
      return <TranslateForm {...props} />;
    case 'listen_pick':
      return <ListenPickForm {...props} />;
    case 'listen_type':
      return <ListenTypeForm {...props} />;
    case 'match_pairs':
      return <MatchPairsForm {...props} />;
    case 'pick_picture':
      return <PickPictureForm {...props} />;
    case 'fill_blank':
      return <FillBlankForm {...props} />;
    case 'spelling':
      return <SpellingForm {...props} />;
    case 'order_sentences':
      return <OrderSentencesForm {...props} />;
    case 'speak_sentence':
      return <SpeakSentenceForm {...props} />;
    case 'speak_words':
      return <SpeakWordsForm {...props} />;
    default:
      return null;
  }
}

// ─── Shared input controls ──────────────────────────────────────────────────

const labelClass =
  'block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1';
const inputClass =
  'w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a] disabled:opacity-50';
const errorClass = 'text-xs text-[#e11d48] font-semibold';

function FormShell({
  children,
  onSubmit,
  onCancel,
  saving,
  disabled,
  error,
}: {
  children: React.ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  saving?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-4">
      {children}
      {error && <p className={errorClass}>{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ede9e1]">
        <Button variant="ghost" size="md" onClick={onCancel} className="!text-[#64748b] hover:!bg-[#f7f4ef]">
          Bekor qilish
        </Button>
        <Button variant="primary" size="md" onClick={onSubmit} loading={saving} disabled={disabled}>
          Saqlash
        </Button>
      </div>
    </div>
  );
}

// ─── MCQ — single-question form ────────────────────────────────────────────

function McqForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  // Existing aggregate POST endpoint stores `{questions: [...]}`. The new
  // generic POST stores one question per component as
  // `{question, options, correctIndex}`. We treat this as the single-row
  // shape — each MCQ component = 1 question.
  const initial = useMemo(() => {
    const cfg = initialConfig as { question?: string; options?: string[]; correctIndex?: number };
    return {
      question: cfg.question ?? '',
      options: cfg.options && cfg.options.length === 4 ? cfg.options : ['', '', '', ''],
      correctIndex: typeof cfg.correctIndex === 'number' ? cfg.correctIndex : 0,
    };
  }, [initialConfig]);

  const [question, setQuestion] = useState(initial.question);
  const [options, setOptions] = useState<string[]>(initial.options);
  const [correctIndex, setCorrectIndex] = useState(initial.correctIndex);
  const [error, setError] = useState('');

  function handleSave() {
    if (!question.trim()) return setError("Savol matni bo'sh bo'lmasin");
    if (options.some((o) => !o.trim())) return setError('Barcha 4 ta variant to\'ldirilsin');
    setError('');
    void onSubmit({ question: question.trim(), options: options.map((o) => o.trim()), correctIndex });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>Savol matni</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={inputClass}
          placeholder="Masalan: What is the capital of Uzbekistan?"
        />
      </div>
      <div className="space-y-2">
        <label className={labelClass}>4 ta variant</label>
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrectIndex(idx)}
              aria-pressed={correctIndex === idx}
              aria-label={`${idx + 1}-javobni to'g'ri deb belgilash`}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                correctIndex === idx ? 'border-emerald-500 bg-emerald-500' : 'border-[#ede9e1]'
              }`}
            >
              {correctIndex === idx && <span className="w-2 h-2 rounded-full bg-white" />}
            </button>
            <input
              type="text"
              value={opt}
              onChange={(e) =>
                setOptions((prev) => prev.map((o, i) => (i === idx ? e.target.value : o)))
              }
              className={inputClass}
              placeholder={`Javob ${idx + 1}`}
            />
          </div>
        ))}
      </div>
    </FormShell>
  );
}

// ─── Word Order — single-sentence form ──────────────────────────────────────

function WordOrderForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const initial = (initialConfig as { correct?: string }).correct ?? '';
  const [correct, setCorrect] = useState(initial);
  const [error, setError] = useState('');

  function handleSave() {
    const trimmed = correct.trim();
    if (trimmed.split(/\s+/).filter(Boolean).length < 2)
      return setError("Kamida 2 ta so'z kiriting");
    setError('');
    const words = trimmed.split(/\s+/).filter(Boolean);
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    void onSubmit({ correct: trimmed, words: shuffled });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>To&apos;g&apos;ri jumla</label>
        <input
          type="text"
          value={correct}
          onChange={(e) => setCorrect(e.target.value)}
          className={inputClass}
          placeholder="Masalan: I am a student"
        />
        <p className="text-xs text-[#64748b] mt-1">
          So&apos;zlar avtomatik aralashtiriladi.
        </p>
      </div>
    </FormShell>
  );
}

// ─── Translate ──────────────────────────────────────────────────────────────

function TranslateForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as {
    sourceText?: string;
    correctAnswer?: string;
    targetLanguage?: 'en' | 'uz';
    acceptedAnswers?: string[];
    hint?: string;
  };
  const [sourceText, setSourceText] = useState(cfg.sourceText ?? '');
  const [correctAnswer, setCorrectAnswer] = useState(cfg.correctAnswer ?? '');
  const [targetLanguage, setTargetLanguage] = useState<'en' | 'uz'>(cfg.targetLanguage ?? 'en');
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(cfg.acceptedAnswers ?? []);
  const [hint, setHint] = useState(cfg.hint ?? '');
  const [error, setError] = useState('');

  function handleSave() {
    if (!sourceText.trim()) return setError('Manba matn kiritilmagan');
    if (!correctAnswer.trim()) return setError("To'g'ri javob kiritilmagan");
    setError('');
    void onSubmit({
      sourceText: sourceText.trim(),
      correctAnswer: correctAnswer.trim(),
      targetLanguage,
      acceptedAnswers: acceptedAnswers.map((a) => a.trim()).filter(Boolean),
      hint: hint.trim() || undefined,
    });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>Yo&apos;nalish</label>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value as 'en' | 'uz')}
          className={inputClass}
        >
          <option value="en">O&apos;zbekcha → English</option>
          <option value="uz">English → O&apos;zbekcha</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Manba matn</label>
        <input
          type="text"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          className={inputClass}
          placeholder={targetLanguage === 'en' ? "O'zbekcha jumla" : 'English sentence'}
        />
      </div>
      <div>
        <label className={labelClass}>To&apos;g&apos;ri javob</label>
        <input
          type="text"
          value={correctAnswer}
          onChange={(e) => setCorrectAnswer(e.target.value)}
          className={inputClass}
          placeholder={targetLanguage === 'en' ? 'English translation' : "O'zbekcha tarjima"}
        />
      </div>
      <StringListEditor
        label="Qo'shimcha qabul qilinadigan javoblar"
        items={acceptedAnswers}
        onChange={setAcceptedAnswers}
        placeholder="Sinonim yoki muqobil tarjima"
      />
      <div>
        <label className={labelClass}>Maslahat (ixtiyoriy)</label>
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className={inputClass}
          placeholder="Talabaga yo'l ko'rsatuvchi qisqa maslahat"
        />
      </div>
    </FormShell>
  );
}

// ─── Listen & Pick ──────────────────────────────────────────────────────────

function ListenPickForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as {
    text?: string;
    options?: { id: string; label: string; imageUrl?: string }[];
    correctOptionId?: string;
  };
  const [text, setText] = useState(cfg.text ?? '');
  const [options, setOptions] = useState<{ id: string; label: string; imageUrl?: string }[]>(
    cfg.options && cfg.options.length === 4
      ? cfg.options
      : ['a', 'b', 'c', 'd'].map((id) => ({ id, label: '', imageUrl: '' })),
  );
  const [correctOptionId, setCorrectOptionId] = useState(cfg.correctOptionId ?? 'a');
  const [error, setError] = useState('');

  function handleSave() {
    if (!text.trim()) return setError('Audio matni kiritilmagan');
    if (options.some((o) => !o.label.trim())) return setError('Barcha variantlar to\'ldirilsin');
    if (!options.some((o) => o.id === correctOptionId)) return setError("To'g'ri variant tanlanmagan");
    setError('');
    void onSubmit({
      text: text.trim(),
      options: options.map((o) => ({
        id: o.id,
        label: o.label.trim(),
        ...(o.imageUrl?.trim() ? { imageUrl: o.imageUrl.trim() } : {}),
      })),
      correctOptionId,
    });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>Audio matni (English)</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
          placeholder="Audioda eshitiladigan English jumla"
        />
      </div>
      <div className="space-y-2">
        <label className={labelClass}>4 ta variant</label>
        {options.map((opt, idx) => (
          <div key={opt.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrectOptionId(opt.id)}
              aria-pressed={correctOptionId === opt.id}
              aria-label={`${opt.id} ni to'g'ri deb belgilash`}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                correctOptionId === opt.id ? 'border-emerald-500 bg-emerald-500' : 'border-[#ede9e1]'
              }`}
            >
              {correctOptionId === opt.id && <span className="w-2 h-2 rounded-full bg-white" />}
            </button>
            <input
              type="text"
              value={opt.label}
              onChange={(e) =>
                setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, label: e.target.value } : o)))
              }
              className={inputClass}
              placeholder={`Variant ${opt.id.toUpperCase()} matni`}
            />
            <input
              type="text"
              value={opt.imageUrl ?? ''}
              onChange={(e) =>
                setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, imageUrl: e.target.value } : o)))
              }
              className={`${inputClass} flex-1 max-w-[160px]`}
              placeholder="Rasm URL (ixtiyoriy)"
            />
          </div>
        ))}
      </div>
    </FormShell>
  );
}

// ─── Listen & Type ──────────────────────────────────────────────────────────

function ListenTypeForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as { text?: string; acceptedAnswers?: string[]; context?: string };
  const [text, setText] = useState(cfg.text ?? '');
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(cfg.acceptedAnswers ?? []);
  const [context, setContext] = useState(cfg.context ?? '');
  const [error, setError] = useState('');

  function handleSave() {
    if (!text.trim()) return setError('Matn kiritilmagan');
    setError('');
    void onSubmit({
      text: text.trim(),
      acceptedAnswers: acceptedAnswers.map((a) => a.trim()).filter(Boolean),
      context: context.trim() || undefined,
    });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>Matn (English)</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
          placeholder="Audioda eshitiladigan jumla"
        />
      </div>
      <StringListEditor
        label="Qo'shimcha qabul qilinadigan javoblar"
        items={acceptedAnswers}
        onChange={setAcceptedAnswers}
        placeholder="Muqobil yozuv"
      />
      <div>
        <label className={labelClass}>Kontekst (ixtiyoriy)</label>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className={inputClass}
          placeholder="Bu jumla qaysi mavzuga oid"
        />
      </div>
    </FormShell>
  );
}

// ─── Match Pairs ────────────────────────────────────────────────────────────

function MatchPairsForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as { pairs?: { left: string; right: string }[] };
  const [pairs, setPairs] = useState<{ left: string; right: string }[]>(
    cfg.pairs && cfg.pairs.length > 0 ? cfg.pairs : [{ left: '', right: '' }, { left: '', right: '' }],
  );
  const [error, setError] = useState('');

  function handleSave() {
    if (pairs.length < 2) return setError('Kamida 2 ta juftlik kerak');
    if (pairs.some((p) => !p.left.trim() || !p.right.trim()))
      return setError('Barcha juftliklar to\'ldirilsin');
    setError('');
    void onSubmit({ pairs: pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })) });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div className="space-y-2">
        <label className={labelClass}>Juftliklar (English / O&apos;zbekcha)</label>
        {pairs.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={p.left}
              onChange={(e) =>
                setPairs((prev) => prev.map((pp, i) => (i === idx ? { ...pp, left: e.target.value } : pp)))
              }
              className={inputClass}
              placeholder="English"
            />
            <input
              type="text"
              value={p.right}
              onChange={(e) =>
                setPairs((prev) => prev.map((pp, i) => (i === idx ? { ...pp, right: e.target.value } : pp)))
              }
              className={inputClass}
              placeholder="O'zbekcha"
            />
            <button
              type="button"
              onClick={() => setPairs((prev) => prev.filter((_, i) => i !== idx))}
              aria-label="Juftlikni o'chirish"
              className="p-2 rounded-lg text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors disabled:opacity-50 shrink-0"
              disabled={pairs.length <= 2}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPairs((prev) => [...prev, { left: '', right: '' }])}
          className="text-xs font-semibold text-[#0f172a] hover:text-[#0d9488] inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Juftlik qo&apos;shish
        </button>
      </div>
    </FormShell>
  );
}

// ─── Pick Picture ───────────────────────────────────────────────────────────

function PickPictureForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as {
    word?: string;
    options?: { id: string; imageUrl: string }[];
    correctOptionId?: string;
  };
  const [word, setWord] = useState(cfg.word ?? '');
  const [options, setOptions] = useState<{ id: string; imageUrl: string }[]>(
    cfg.options && cfg.options.length === 4
      ? cfg.options
      : ['a', 'b', 'c', 'd'].map((id) => ({ id, imageUrl: '' })),
  );
  const [correctOptionId, setCorrectOptionId] = useState(cfg.correctOptionId ?? 'a');
  const [error, setError] = useState('');

  function handleSave() {
    if (!word.trim()) return setError("So'z kiritilmagan");
    if (options.some((o) => !o.imageUrl.trim())) return setError('Barcha rasm URL\'lari to\'ldirilsin');
    if (!options.some((o) => o.id === correctOptionId)) return setError("To'g'ri rasm tanlanmagan");
    setError('');
    void onSubmit({
      word: word.trim(),
      options: options.map((o) => ({ id: o.id, imageUrl: o.imageUrl.trim() })),
      correctOptionId,
    });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>So&apos;z (English)</label>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          className={inputClass}
          placeholder="apple"
        />
      </div>
      <div className="space-y-2">
        <label className={labelClass}>4 ta rasm</label>
        {options.map((opt, idx) => (
          <div key={opt.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrectOptionId(opt.id)}
              aria-pressed={correctOptionId === opt.id}
              aria-label={`${opt.id} ni to'g'ri rasm deb belgilash`}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                correctOptionId === opt.id ? 'border-emerald-500 bg-emerald-500' : 'border-[#ede9e1]'
              }`}
            >
              {correctOptionId === opt.id && <span className="w-2 h-2 rounded-full bg-white" />}
            </button>
            <span className="text-xs font-bold text-[#64748b] w-4">{opt.id.toUpperCase()}</span>
            <input
              type="text"
              value={opt.imageUrl}
              onChange={(e) =>
                setOptions((prev) =>
                  prev.map((o, i) => (i === idx ? { ...o, imageUrl: e.target.value } : o)),
                )
              }
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        ))}
      </div>
    </FormShell>
  );
}

// ─── Fill Blank ─────────────────────────────────────────────────────────────

function FillBlankForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as {
    sentence?: string;
    blank?: string;
    acceptedAnswers?: string[];
    alternatives?: string[];
  };
  const [sentence, setSentence] = useState(cfg.sentence ?? '');
  const [blank, setBlank] = useState(cfg.blank ?? '');
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(cfg.acceptedAnswers ?? []);
  const [alternatives, setAlternatives] = useState<string[]>(cfg.alternatives ?? []);
  const [error, setError] = useState('');

  function handleSave() {
    if (!sentence.includes('___'))
      return setError("Jumlaga `___` belgi qo'shing (bo'sh joy uchun)");
    if (!blank.trim()) return setError("To'g'ri so'z kiritilmagan");
    setError('');
    void onSubmit({
      sentence: sentence.trim(),
      blank: blank.trim(),
      acceptedAnswers: acceptedAnswers.map((a) => a.trim()).filter(Boolean),
      alternatives: alternatives.map((a) => a.trim()).filter(Boolean),
    });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>Jumla (`___` — bo&apos;sh joy)</label>
        <input
          type="text"
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          className={inputClass}
          placeholder="The ___ is red"
        />
      </div>
      <div>
        <label className={labelClass}>To&apos;g&apos;ri so&apos;z</label>
        <input
          type="text"
          value={blank}
          onChange={(e) => setBlank(e.target.value)}
          className={inputClass}
          placeholder="apple"
        />
      </div>
      <StringListEditor
        label="Sinonim javoblar (qabul qilinadi)"
        items={acceptedAnswers}
        onChange={setAcceptedAnswers}
        placeholder="Boshqa to'g'ri so'z"
      />
      <StringListEditor
        label="Tap-bank variantlari (ixtiyoriy)"
        items={alternatives}
        onChange={setAlternatives}
        placeholder="Distraktor"
      />
    </FormShell>
  );
}

// ─── Spelling ───────────────────────────────────────────────────────────────

function SpellingForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as { word?: string; audioPlay?: boolean };
  const [word, setWord] = useState(cfg.word ?? '');
  const [audioPlay, setAudioPlay] = useState<boolean>(cfg.audioPlay !== false);
  const [error, setError] = useState('');

  function handleSave() {
    const trimmed = word.trim();
    if (!trimmed) return setError("So'z kiritilmagan");
    if (trimmed.length > 30) return setError("So'z 30 belgidan oshmasin");
    setError('');
    void onSubmit({ word: trimmed, audioPlay });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>So&apos;z (English)</label>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          className={inputClass}
          placeholder="elephant"
        />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-[#0f172a] font-semibold">
        <input
          type="checkbox"
          checked={audioPlay}
          onChange={(e) => setAudioPlay(e.target.checked)}
          className="w-4 h-4 accent-emerald-500"
        />
        Audio avtomatik o&apos;ynalsin
      </label>
    </FormShell>
  );
}

// ─── Order Sentences ────────────────────────────────────────────────────────

function OrderSentencesForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as { sentences?: string[] };
  const [sentences, setSentences] = useState<string[]>(cfg.sentences ?? ['', '', '']);
  const [error, setError] = useState('');

  function handleSave() {
    const cleaned = sentences.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length < 2) return setError('Kamida 2 ta jumla kerak');
    setError('');
    void onSubmit({ sentences: cleaned });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div className="space-y-2">
        <label className={labelClass}>
          Jumlalar (to&apos;g&apos;ri tartibda — runtime aralashtiriladi)
        </label>
        {sentences.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748b] w-5">{idx + 1}.</span>
            <input
              type="text"
              value={s}
              onChange={(e) =>
                setSentences((prev) => prev.map((x, i) => (i === idx ? e.target.value : x)))
              }
              className={inputClass}
              placeholder={`Jumla ${idx + 1}`}
            />
            <button
              type="button"
              onClick={() => setSentences((prev) => prev.filter((_, i) => i !== idx))}
              aria-label="Jumlani o'chirish"
              className="p-2 rounded-lg text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors disabled:opacity-50 shrink-0"
              disabled={sentences.length <= 2}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSentences((prev) => [...prev, ''])}
          className="text-xs font-semibold text-[#0f172a] hover:text-[#0d9488] inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Jumla qo&apos;shish
        </button>
      </div>
    </FormShell>
  );
}

// ─── Speak Sentence ─────────────────────────────────────────────────────────

function SpeakSentenceForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as { sentence?: string; minScore?: number };
  const [sentence, setSentence] = useState(cfg.sentence ?? '');
  const [minScore, setMinScore] = useState<number>(typeof cfg.minScore === 'number' ? cfg.minScore : 70);
  const [error, setError] = useState('');

  function handleSave() {
    if (!sentence.trim()) return setError('Jumla kiritilmagan');
    if (minScore < 0 || minScore > 100) return setError('minScore 0 dan 100 gacha bo\'lsin');
    setError('');
    void onSubmit({ sentence: sentence.trim(), minScore });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>Jumla (English)</label>
        <input
          type="text"
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          className={inputClass}
          placeholder="The cat is on the mat"
        />
      </div>
      <div>
        <label className={labelClass}>O&apos;tish bali (0-100)</label>
        <input
          type="number"
          value={minScore}
          min={0}
          max={100}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className={inputClass}
        />
      </div>
    </FormShell>
  );
}

// ─── Speak Words form (J) ───────────────────────────────────────────────────

function SpeakWordsForm({ initialConfig, onSubmit, onCancel, saving }: FormProps) {
  const cfg = initialConfig as { text?: string; minScore?: number };
  const [text, setText] = useState(cfg.text ?? '');
  const [minScore, setMinScore] = useState<number>(
    typeof cfg.minScore === 'number' ? cfg.minScore : 70,
  );
  const [error, setError] = useState('');

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  function handleSave() {
    if (!text.trim()) return setError('Matn kiritilmagan');
    if (wordCount < 2) return setError("Kamida 2 ta so'z kerak");
    if (minScore < 0 || minScore > 100)
      return setError("Aniqlik foizi 0 dan 100 gacha bo'lsin");
    setError('');
    void onSubmit({ text: text.trim(), minScore });
  }

  return (
    <FormShell onSubmit={handleSave} onCancel={onCancel} saving={saving} error={error}>
      <div>
        <label className={labelClass}>Matn (English) — har bir so&apos;z alohida talaffuz qilinadi</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${inputClass} min-h-[110px] resize-y`}
          placeholder="In the United States, Cinco de Mayo has evolved into a celebration of Mexican culture and heritage."
        />
        <p className="text-xs text-[#64748b] mt-1 font-semibold">
          {wordCount} ta so&apos;z. Tinish belgilari avtomatik olib tashlanadi.
        </p>
      </div>
      <div>
        <label className={labelClass}>Aniqlik foizi (0-100) — bundan past bo&apos;lsa qayta urinadi</label>
        <input
          type="number"
          value={minScore}
          min={0}
          max={100}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className={inputClass}
        />
      </div>
    </FormShell>
  );
}

// ─── Reusable: editable list of strings ─────────────────────────────────────

function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  // Local mirror for empty rows so the user can type in a freshly-added row
  // without parent-state shenanigans.
  const [rows, setRows] = useState<string[]>(items.length > 0 ? items : []);
  useEffect(() => {
    setRows(items);
  }, [items]);

  function update(idx: number, val: string) {
    const next = rows.map((r, i) => (i === idx ? val : r));
    setRows(next);
    onChange(next);
  }
  function remove(idx: number) {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    onChange(next);
  }
  function add() {
    const next = [...rows, ''];
    setRows(next);
    onChange(next);
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="space-y-2">
        {rows.map((r, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={r}
              onChange={(e) => update(idx, e.target.value)}
              className={inputClass}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label="Qatorni o'chirish"
              className="p-2 rounded-lg text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-xs font-semibold text-[#0f172a] hover:text-[#0d9488] inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Qator qo&apos;shish
        </button>
      </div>
    </div>
  );
}

// Re-export for parent so it can map type → label without two imports.
export { COMPONENT_LABELS };
export type { ConfigComponent };
