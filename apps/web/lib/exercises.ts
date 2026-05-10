import { apiRequest } from './api';

/**
 * Pass 1: Typed wrappers for the new AI endpoints used by the 10 new
 * Duolingo-style exercise types. Pass 2-4 components import from here so
 * they don't have to repeat `apiRequest<...>('/ai/...')` boilerplate.
 */

// AI endpoints can be slow when the upstream LLM is degraded. The exercise
// runners ALL have local strict-match / canned-feedback fallbacks, so a
// hung AI call is strictly worse than a fast failure. Race the request
// against this timeout so wrong-answer flows never freeze the lesson.
const AI_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export interface GradeTranslationDto {
  sourceText: string;
  targetLanguage: 'en' | 'uz';
  studentAnswer: string;
  /** Canonical correct answer from lesson config — ground truth for the
   *  strict-match fast path + fallback. Send when available so a missing
   *  Claude key never blocks correct answers. */
  correctAnswer?: string;
  /** Author-curated alternate translations (e.g., "I'm a student"). */
  acceptedAnswers?: string[];
  context?: string;
}

export interface GradeTranslationResponse {
  correct: boolean;
  score: number;
  feedback: string;
  accepted_answers?: string[];
}

/**
 * Fuzzy-grade a typed translation answer (used by the `translate`
 * exercise type). Returns the AI's verdict + 1-2 sentence Uzbek feedback.
 */
export async function gradeTranslation(
  payload: GradeTranslationDto,
  token: string,
): Promise<GradeTranslationResponse> {
  const res = await withTimeout(
    apiRequest<GradeTranslationResponse>(
      '/ai/grade-translation',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
    AI_TIMEOUT_MS,
    'gradeTranslation',
  );
  return res.data;
}

export interface ExplainAnswerDto {
  exerciseType: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  context?: string;
}

export interface ExplainAnswerResponse {
  explanation: string;
  hint: string;
  examples?: string[];
}

/**
 * Get a kid-friendly Uzbek explanation for why an answer was wrong
 * (feature M, "Tushuntirish" button). Works for any exercise type.
 */
export async function explainAnswer(
  payload: ExplainAnswerDto,
  token: string,
): Promise<ExplainAnswerResponse> {
  const res = await withTimeout(
    apiRequest<ExplainAnswerResponse>(
      '/ai/explain-answer',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
    AI_TIMEOUT_MS,
    'explainAnswer',
  );
  return res.data;
}

export interface TtsResponse {
  audioBase64: string;
  mimeType: string;
}

/**
 * Fetch TTS audio as a base64 buffer + mime type. Pass 1 added the
 * `language` parameter so the same endpoint serves listening / spelling
 * exercises (English) AND vocabulary playback (Uzbek).
 *
 * @returns the raw response so callers can also detect an empty buffer
 *          (Azure not configured) and fall back to text mode.
 */
export async function getTtsAudio(
  text: string,
  language: 'en' | 'uz',
  token: string,
): Promise<TtsResponse> {
  const res = await apiRequest<TtsResponse>(
    '/ai/tts',
    { method: 'POST', body: JSON.stringify({ text, language }) },
    token,
  );
  return res.data;
}

/**
 * Convenience helper: returns a `data:` URL ready to plug into an
 * `<audio>` element, or `null` if the server returned an empty buffer
 * (e.g. Azure creds missing in dev). Frontends use this for the simple
 * "play / replay" buttons in listening exercises.
 */
export async function getTtsAudioUrl(
  text: string,
  language: 'en' | 'uz',
  token: string,
): Promise<string | null> {
  const audio = await getTtsAudio(text, language, token);
  if (!audio.audioBase64) return null;
  return `data:${audio.mimeType};base64,${audio.audioBase64}`;
}
