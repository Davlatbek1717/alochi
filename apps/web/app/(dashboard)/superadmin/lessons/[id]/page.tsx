'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  type: string;
  orderNumber: number;
  youtubeUrl: string;
  nRepetitions: number;
  isPublished: boolean;
  components: Record<string, boolean>;
}

interface McqQuestion {
  text: string;
  options: string[];
  correct: number;
}

interface WordOrderSentence {
  words: string[];
  correct: string;
}

interface LessonComponent {
  type: string;
  config: {
    questions?: McqQuestion[];
    sentences?: WordOrderSentence[];
  };
}

export default function EditLessonPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'mcq' | 'word_order'>('info');

  // MCQ state
  const [mcqQuestions, setMcqQuestions] = useState<McqQuestion[]>([]);
  const [savingMcq, setSavingMcq] = useState(false);

  // Word order state
  const [wordSentences, setWordSentences] = useState<WordOrderSentence[]>([]);
  const [savingWord, setSavingWord] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Lesson>(`/lessons/${id}`, {}, token),
      apiRequest<LessonComponent[]>(`/lessons/${id}/components`, {}, token),
    ])
      .then(([lessonRes, compRes]) => {
        setLesson(lessonRes.data);
        const mcqComp = compRes.data.find((c) => c.type === 'mcq');
        const wordComp = compRes.data.find((c) => c.type === 'word_order');
        if (mcqComp?.config.questions) setMcqQuestions(mcqComp.config.questions);
        if (wordComp?.config.sentences) setWordSentences(wordComp.config.sentences);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function publishLesson() {
    setPublishing(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/publish`, { method: 'PATCH' }, token);
      setLesson((prev) => prev ? { ...prev, isPublished: true } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setPublishing(false);
    }
  }

  async function saveMcq() {
    setSavingMcq(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/mcq`, {
        method: 'POST',
        body: JSON.stringify({ questions: mcqQuestions }),
      }, token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSavingMcq(false);
    }
  }

  async function saveWordOrder() {
    setSavingWord(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/word-order`, {
        method: 'POST',
        body: JSON.stringify({ sentences: wordSentences }),
      }, token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSavingWord(false);
    }
  }

  function addMcqQuestion() {
    setMcqQuestions((prev) => [
      ...prev,
      { text: '', options: ['', '', '', ''], correct: 0 },
    ]);
  }

  function updateMcqQuestion(idx: number, field: string, value: string | number) {
    setMcqQuestions((prev) =>
      prev.map((q, i) => i === idx ? { ...q, [field]: value } : q)
    );
  }

  function updateMcqOption(qIdx: number, optIdx: number, value: string) {
    setMcqQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => j === optIdx ? value : o) }
          : q
      )
    );
  }

  function removeMcqQuestion(idx: number) {
    setMcqQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addWordSentence() {
    setWordSentences((prev) => [...prev, { words: [], correct: '' }]);
  }

  function updateWordSentence(idx: number, correct: string) {
    const words = correct.trim().split(/\s+/).filter(Boolean);
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWordSentences((prev) =>
      prev.map((s, i) => i === idx ? { words: shuffled, correct } : s)
    );
  }

  function removeWordSentence(idx: number) {
    setWordSentences((prev) => prev.filter((_, i) => i !== idx));
  }

  if (loading) return <div className="text-gray-500 p-6">Yuklanmoqda...</div>;
  if (!lesson) return <div className="text-red-500 p-6">Dars topilmadi</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/superadmin/lessons" className="text-gray-400 hover:text-gray-600">
            ← Orqaga
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
        </div>
        {!lesson.isPublished && (
          <button
            onClick={publishLesson}
            disabled={publishing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? '...' : '✅ Nashr qilish'}
          </button>
        )}
        {lesson.isPublished && (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
            Nashr qilingan
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Info panel */}
      <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Tartib:</span>{' '}
          <span className="font-medium">#{lesson.orderNumber}</span>
        </div>
        <div>
          <span className="text-gray-500">Turi:</span>{' '}
          <span className="font-medium">{lesson.type}</span>
        </div>
        <div>
          <span className="text-gray-500">N takror:</span>{' '}
          <span className="font-medium">{lesson.nRepetitions}x</span>
        </div>
        <div>
          <span className="text-gray-500">YouTube:</span>{' '}
          <a
            href={lesson.youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline truncate"
          >
            Ko&apos;rish
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: 'info', label: 'Umumiy' },
          { key: 'mcq', label: `MCQ (${mcqQuestions.length})` },
          { key: 'word_order', label: `So'z tartibi (${wordSentences.length})` },
        ] as { key: typeof activeTab; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Umumiy */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600 text-sm">
            Dars ma&apos;lumotlarini tahrirlash uchun yangi dars yarating yoki administrator
            bilan bog&apos;laning. MCQ va So&apos;z tartibi tablarida komponentlarni boshqaring.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Yoqilgan komponentlar:</p>
            <div className="flex gap-2 flex-wrap">
              {lesson.components.mcq && (
                <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                  MCQ — {mcqQuestions.length} ta savol
                </span>
              )}
              {lesson.components.word_order && (
                <span className="bg-purple-100 text-purple-700 text-sm px-3 py-1 rounded-full">
                  So&apos;z tartibi — {wordSentences.length} ta jumla
                </span>
              )}
              {lesson.components.vocabulary && (
                <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
                  Lug&apos;at
                </span>
              )}
              {!lesson.components.mcq && !lesson.components.word_order && !lesson.components.vocabulary && (
                <span className="text-gray-400 text-sm">Komponent yo&apos;q</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: MCQ */}
      {activeTab === 'mcq' && (
        <div className="space-y-3">
          {mcqQuestions.map((q, qIdx) => (
            <div key={qIdx} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-gray-500">Savol {qIdx + 1}</span>
                <button
                  onClick={() => removeMcqQuestion(qIdx)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  O&apos;chirish
                </button>
              </div>
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateMcqQuestion(qIdx, 'text', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Savol matni..."
              />
              <div className="space-y-2">
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex gap-2 items-center">
                    <input
                      type="radio"
                      name={`correct-${qIdx}`}
                      checked={q.correct === optIdx}
                      onChange={() => updateMcqQuestion(qIdx, 'correct', optIdx)}
                      className="w-4 h-4 text-green-600"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateMcqOption(qIdx, optIdx, e.target.value)}
                      className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                        q.correct === optIdx
                          ? 'border-green-400 focus:ring-green-400'
                          : 'border-gray-200 focus:ring-indigo-500'
                      }`}
                      placeholder={`Javob ${optIdx + 1}`}
                    />
                    {q.correct === optIdx && (
                      <span className="text-green-600 text-xs font-medium">✓ To&apos;g&apos;ri</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={addMcqQuestion}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 text-sm font-medium transition-colors"
          >
            + Savol qo&apos;shish
          </button>

          {mcqQuestions.length > 0 && (
            <button
              onClick={saveMcq}
              disabled={savingMcq}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingMcq ? 'Saqlanmoqda...' : `MCQ savollarni saqlash (${mcqQuestions.length} ta)`}
            </button>
          )}
        </div>
      )}

      {/* Tab: Word Order */}
      {activeTab === 'word_order' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            To&apos;g&apos;ri jumlani kiriting — so&apos;zlar avtomatik aralashtiriladi.
          </p>

          {wordSentences.map((s, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Jumla {idx + 1}</span>
                <button
                  onClick={() => removeWordSentence(idx)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  O&apos;chirish
                </button>
              </div>
              <input
                type="text"
                value={s.correct}
                onChange={(e) => updateWordSentence(idx, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="To'g'ri jumla (masalan: I am a student)"
              />
              {s.words.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-gray-400 w-full">Aralashtirilgan:</span>
                  {s.words.map((w, wi) => (
                    <span key={wi} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addWordSentence}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 text-sm font-medium transition-colors"
          >
            + Jumla qo&apos;shish
          </button>

          {wordSentences.length > 0 && (
            <button
              onClick={saveWordOrder}
              disabled={savingWord}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingWord ? 'Saqlanmoqda...' : `So'z tartibi saqlash (${wordSentences.length} ta)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
