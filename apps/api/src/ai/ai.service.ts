import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenAI } from '@google/genai';
import { StatusService } from '../student-status/status.service';
import { StatusColor } from '../student-status/status.types';

// Gemini 2.5 Flash — fast, cheap, multilingual (good Uzbek), supports
// system instructions + JSON mode. We use it for tutor chat, translation
// grading, wrong-answer explanations, and error pattern analysis.
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Phase 21.1: retry transient failures (5xx, network errors, timeouts) for
 * external AI calls. Skips 4xx because client errors are not transient.
 * Backoff: 500ms, 1000ms, 1500ms.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  max = 3,
  baseMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < max; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const err = e as {
        response?: { status?: number };
        code?: string;
        message?: string;
      };
      const status = err?.response?.status;
      const isClientError =
        typeof status === 'number' && status >= 400 && status < 500;
      const isRetryable = !isClientError;
      if (!isRetryable || i === max - 1) break;
      await new Promise((r) => setTimeout(r, baseMs * (i + 1)));
    }
  }
  throw lastErr;
}

@Injectable()
export class AiService {
  private readonly aiServiceUrl: string;
  private genai: GoogleGenAI;
  private readonly logger = new Logger(AiService.name);

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
    private statusService: StatusService,
  ) {
    this.aiServiceUrl = this.config.get(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    this.genai = new GoogleGenAI({
      apiKey: this.config.get('GEMINI_API_KEY', ''),
    });
  }

  async askTutor(
    lessonContext: string,
    question: string,
    history: { role: string; content: string }[],
  ) {
    // Try the Python AI microservice first (richer pedagogical features when
    // available). On any failure — including when the service simply isn't
    // running — fall through to a direct Gemini call so the student is never
    // blocked. Keeps the behaviour simple in dev where only the API + DB
    // containers are up.
    if (this.aiServiceUrl) {
      try {
        const res = await withRetry(
          () =>
            firstValueFrom(
              this.http.post(`${this.aiServiceUrl}/ai/tutor/ask`, {
                lesson_context: lessonContext,
                question,
                conversation_history: history,
              }),
            ),
          1,
        );
        return res.data;
      } catch (err) {
        this.logger.warn(
          `askTutor: Python AI service unreachable, falling back to Gemini. ${(err as Error).message}`,
        );
      }
    }

    // Direct Gemini fallback. Encourages short, friendly Uzbek answers
    // appropriate for 3-7 graders and stays within the lesson context so
    // the tutor doesn't drift off-topic. Gemini's chat format uses
    // role: 'model' for assistant turns (not 'assistant').
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] =
      [];
    for (const turn of history) {
      if (!turn.content) continue;
      const role: 'user' | 'model' =
        turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: turn.content }] });
    }
    contents.push({ role: 'user', parts: [{ text: question }] });

    try {
      const response = await withRetry(() =>
        this.genai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction:
              "Sen 3-7 sinf o'quvchilari uchun do'stona ingliz tili o'qituvchisisan. " +
              "Javoblaringni o'zbek tilida ber, qisqa va aniq (1-3 jumla). " +
              'Iloji boricha 1-2 ta inglizcha misol qoshib, ularni qavs ichida tarjima qil. ' +
              'Faqat darsdagi mavzuga oid javob ber.\n\n' +
              `DARS KONTEKSTI: ${lessonContext || 'umumiy ingliz tili savol-javobi'}`,
            maxOutputTokens: 350,
            temperature: 0.7,
          },
        }),
      );
      const text = response.text ?? '';
      return {
        answer:
          text || 'Kechirasiz, hozir javob bera olmayman. Yana savol bering.',
      };
    } catch (err) {
      this.logger.error(
        `askTutor: Gemini fallback also failed. ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException('AI servis vaqtincha ishlamayapti');
    }
  }

  /**
   * Score a student's lesson answers via the Python evaluation service
   * (Gemini under the hood). When `studentId` is provided, the resulting
   * score is also mapped to a {@link StatusColor} and persisted onto
   * today's `englishStatus` slot via {@link StatusService.setEnglishStatus}.
   *
   * Score → colour mapping (spec):
   *   ≥ 80 → yashil, 50–79 → sariq, < 50 → qizil
   */
  async evaluate(
    lessonContext: string,
    studentAnswers: { question: string; student_answer: string }[],
    studentId?: string,
    lessonId?: string,
  ) {
    let data: { score?: number } & Record<string, unknown>;
    try {
      const res = await withRetry(() =>
        firstValueFrom(
          this.http.post(`${this.aiServiceUrl}/ai/evaluate/`, {
            lesson_context: lessonContext,
            student_answers: studentAnswers,
          }),
        ),
      );
      data = res.data;
    } catch {
      throw new ServiceUnavailableException(
        'Baholash servisi vaqtincha ishlamayapti',
      );
    }

    // Persist Uzbek-canonical englishStatus when caller gave us a student.
    if (studentId && typeof data?.score === 'number') {
      const color = AiService.scoreToStatusColor(data.score);
      try {
        await this.statusService.setEnglishStatus(studentId, color, {
          source: 'ai_evaluation',
          lessonId,
          score: data.score,
        });
      } catch (err) {
        // Status update is best-effort; never fail the evaluation
        // response on a downstream notification glitch.
        this.logger.warn(
          `setEnglishStatus failed for student ${studentId}: ${(err as Error).message}`,
        );
      }
    }

    return data;
  }

  /** ≥80 yashil, 50-79 sariq, <50 qizil. */
  static scoreToStatusColor(score: number): StatusColor {
    if (score >= 80) return 'yashil';
    if (score >= 50) return 'sariq';
    return 'qizil';
  }

  async checkPronunciation(wordEn: string, audioBase64: string) {
    try {
      const res = await withRetry(() =>
        firstValueFrom(
          this.http.post(`${this.aiServiceUrl}/ai/speech/check`, {
            word_en: wordEn,
            audio_base64: audioBase64,
          }),
        ),
      );
      return res.data;
    } catch {
      return {
        is_correct: true,
        accuracy_score: 100,
        feedback: 'Fallback mode',
      };
    }
  }

  private sm2(
    quality: number,
    easeFactor: number,
    interval: number,
    repetitions: number,
  ) {
    if (quality < 3) {
      return { interval: 1, easeFactor, repetitions: 0 };
    }
    const newEf = Math.max(
      1.3,
      easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
    );
    let newInterval: number;
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval * newEf);
    return {
      interval: newInterval,
      easeFactor: newEf,
      repetitions: repetitions + 1,
    };
  }

  async recordSpacedAnswer(studentId: string, word: string, correct: boolean) {
    const quality = correct ? 4 : 1;

    const existing = await this.prisma.spacedRepetitionItem.findUnique({
      where: { studentId_word: { studentId, word } },
    });

    const { interval, easeFactor, repetitions } = this.sm2(
      quality,
      existing?.easeFactor ?? 2.5,
      existing?.interval ?? 1,
      existing?.repetitions ?? 0,
    );

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    await this.prisma.spacedRepetitionItem.upsert({
      where: { studentId_word: { studentId, word } },
      update: { easeFactor, interval, repetitions, nextReview },
      create: {
        studentId,
        word,
        easeFactor,
        interval,
        repetitions,
        nextReview,
      },
    });

    return { word, nextReview, interval };
  }

  async getDailyReview(studentId: string) {
    const now = new Date();
    const items = await this.prisma.spacedRepetitionItem.findMany({
      where: { studentId, nextReview: { lte: now } },
      orderBy: { nextReview: 'asc' },
      take: 20,
      select: { word: true, easeFactor: true, interval: true },
    });
    return items;
  }

  async recordError(studentId: string, lessonId: string, question: string) {
    const updated = await this.prisma.errorLog.upsert({
      where: { studentId_lessonId_question: { studentId, lessonId, question } },
      update: { errorCount: { increment: 1 }, lastError: new Date() },
      create: { studentId, lessonId, question, errorCount: 1 },
    });
    return updated;
  }

  async analyzeErrors(
    studentId: string,
  ): Promise<{ weakAreas: string[]; recommendation: string }> {
    const errors = await this.prisma.errorLog.findMany({
      where: { studentId, errorCount: { gte: 2 } },
      orderBy: { errorCount: 'desc' },
      take: 10,
      select: { question: true, errorCount: true },
    });

    if (errors.length === 0) {
      return { weakAreas: [], recommendation: "Hozircha xatolar yo'q." };
    }

    const errorList = errors
      .map((e) => `"${e.question}" (${e.errorCount} marta xato)`)
      .join('\n');

    try {
      const response = await withRetry(() =>
        this.genai.models.generateContent({
          model: GEMINI_MODEL,
          contents:
            `O'quvchining quyidagi savollarda xatolari bor:\n${errorList}\n\n` +
            `Qisqa tahlil qil: 1) Zaif tomonlari (3 ta kalit so'z bilan), 2) Bitta tavsiya. ` +
            `Javobni JSON formatida ber: {"weakAreas": ["...", "..."], "recommendation": "..."}`,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 300,
            temperature: 0.4,
          },
        }),
      );
      const raw = response.text ?? '{}';
      // responseMimeType: 'application/json' usually returns clean JSON, but
      // be defensive in case the model wraps it in fences or stray text.
      const parsed = AiService.parseAnalyzeErrorsJson(raw);
      if (parsed) return parsed;
    } catch (err) {
      this.logger.warn(
        `analyzeErrors fell back to canned response: ${(err as Error).message}`,
      );
    }
    return {
      weakAreas: ['Grammatika', "Lug'at"],
      recommendation: "Qayta ko'rib chiqing.",
    };
  }

  /** Tolerant parser for {@link analyzeErrors}. */
  static parseAnalyzeErrorsJson(
    raw: string,
  ): { weakAreas: string[]; recommendation: string } | null {
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const slice = fenced ? fenced[1] : raw;
    const first = slice.indexOf('{');
    const last = slice.lastIndexOf('}');
    if (first < 0 || last < 0 || last <= first) return null;
    try {
      const parsed = JSON.parse(slice.slice(first, last + 1)) as {
        weakAreas?: unknown;
        recommendation?: unknown;
      };
      if (
        !Array.isArray(parsed.weakAreas) ||
        typeof parsed.recommendation !== 'string'
      ) {
        return null;
      }
      const weakAreas = parsed.weakAreas.filter(
        (s): s is string => typeof s === 'string',
      );
      return { weakAreas, recommendation: parsed.recommendation };
    } catch {
      return null;
    }
  }

  /**
   * 25.H.3 / Pass 1: Text-to-speech.
   *
   * Originally English-only; Pass 1 adds the optional `language` argument so
   * the same endpoint serves listening / spelling exercises (en-US-Jenny)
   * AND Uzbek vocabulary playback (uz-UZ-Madina). When the language is
   * omitted we keep the legacy English default so older callers
   * (vocabulary cards) keep working unchanged.
   *
   * Defers to Azure Speech REST when `AZURE_SPEECH_KEY` is set; otherwise
   * returns an empty placeholder buffer so the frontend stays usable in dev.
   * Returns base64-encoded audio.
   */
  async tts(
    text: string,
    voiceOrLanguage: string = 'en-US-JennyNeural',
    language?: 'en' | 'uz',
  ): Promise<{
    audioBase64: string;
    mimeType: string;
  }> {
    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;
    if (!azureKey || !azureRegion || !text) {
      return { audioBase64: '', mimeType: 'audio/mpeg' };
    }

    const lang = language ?? 'en';
    // Caller can override the voice explicitly; otherwise pick a sensible
    // default per language. Voices we use today:
    //   en-US-JennyNeural  — friendly American English (kid-friendly)
    //   uz-UZ-MadinaNeural — Uzbek female
    const defaultVoice =
      lang === 'uz' ? 'uz-UZ-MadinaNeural' : 'en-US-JennyNeural';
    const voice =
      voiceOrLanguage && voiceOrLanguage !== 'en-US-JennyNeural'
        ? voiceOrLanguage
        : defaultVoice;
    const xmlLang = lang === 'uz' ? 'uz-UZ' : 'en-US';

    const ssml =
      `<speak version='1.0' xml:lang='${xmlLang}'>` +
      `<voice name='${voice}'>${escapeXml(text)}</voice></speak>`;
    try {
      const res = await fetch(
        `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          },
          body: ssml,
        },
      );
      if (!res.ok) return { audioBase64: '', mimeType: 'audio/mpeg' };
      const buf = Buffer.from(await res.arrayBuffer());
      return { audioBase64: buf.toString('base64'), mimeType: 'audio/mpeg' };
    } catch {
      return { audioBase64: '', mimeType: 'audio/mpeg' };
    }
  }

  /**
   * Pass 1: Fuzzy translation grader for the `translate` exercise type.
   *
   * Forgives typos (1-2 chars), synonyms, capitalisation, and minor
   * punctuation differences. Falls back to strict case-insensitive string
   * match if Gemini is unavailable or returns malformed JSON, so the UI
   * stays responsive even when the AI call fails.
   *
   * @returns `{ correct, score 0-100, feedback (Uzbek), accepted_answers? }`
   */
  async gradeTranslation(input: {
    sourceText: string;
    targetLanguage: 'en' | 'uz';
    studentAnswer: string;
    correctAnswer?: string;
    acceptedAnswers?: string[];
    context?: string;
  }): Promise<{
    correct: boolean;
    score: number;
    feedback: string;
    accepted_answers?: string[];
  }> {
    // Strict-match shortcut: if the student typed exactly the canonical
    // answer (or any accepted variant), short-circuit to "correct" without
    // burning a Gemini call. This also makes the lesson resilient to a
    // missing/misconfigured ANTHROPIC_API_KEY.
    if (input.correctAnswer) {
      const fast = AiService.strictTranslationMatch(
        input.studentAnswer,
        input.correctAnswer,
        input.acceptedAnswers,
      );
      if (fast) return fast;
    }

    const prompt =
      `You are a strict but fair English-Uzbek translation grader for grade 3-7 students.\n\n` +
      `SOURCE: "${input.sourceText}"\n` +
      `TARGET LANGUAGE: ${input.targetLanguage}\n` +
      `STUDENT ANSWER: "${input.studentAnswer}"\n` +
      (input.correctAnswer
        ? `CANONICAL CORRECT TRANSLATION: "${input.correctAnswer}"\n`
        : '') +
      (input.acceptedAnswers?.length
        ? `OTHER ACCEPTED TRANSLATIONS: ${input.acceptedAnswers.map((a) => `"${a}"`).join(', ')}\n`
        : '') +
      `CONTEXT: ${input.context ?? 'none'}\n\n` +
      `Rules:\n` +
      `- Forgive minor typos (1-2 character differences) — score >= 70 still\n` +
      `- Forgive synonyms and natural variations\n` +
      `- Capitalization doesn't matter\n` +
      `- Punctuation differences <= 1 don't matter\n` +
      `- Major meaning errors → score 0-40\n` +
      `- Acceptable but awkward → score 60-80\n` +
      `- Perfect → score 100\n\n` +
      `Respond with EXACTLY this JSON:\n` +
      `{ "correct": boolean, "score": 0-100, "feedback": "1-2 sentence Uzbek explanation", "accepted_answers": ["alt1", "alt2"] }\n\n` +
      `- correct: true if score >= 70\n` +
      `- feedback: in Uzbek, gentle for 3rd-7th graders\n` +
      `- accepted_answers: 2-3 alternative valid translations of source`;

    try {
      const response = await withRetry(() =>
        this.genai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 200,
            temperature: 0.2,
          },
        }),
      );
      const text = response.text ?? '{}';
      const parsed = AiService.parseGraderJson(text);
      if (parsed) return parsed;
    } catch (err) {
      this.logger.warn(
        `gradeTranslation fell back to strict match: ${(err as Error).message}`,
      );
    }
    return AiService.strictTranslationFallback(
      input.studentAnswer,
      input.correctAnswer,
      input.acceptedAnswers,
    );
  }

  /**
   * Pass 1 (revised): Strict-match shortcut. If the student typed exactly
   * the canonical answer or any accepted variant (case-insensitive trim),
   * pass without calling the AI. Returns null when no match so the caller
   * can fall through to Gemini.
   */
  static strictTranslationMatch(
    studentAnswer: string,
    correctAnswer: string,
    acceptedAnswers?: string[],
  ): { correct: boolean; score: number; feedback: string } | null {
    const norm = studentAnswer.trim().toLowerCase();
    if (!norm) return null;
    const candidates = [correctAnswer, ...(acceptedAnswers ?? [])]
      .map((a) => a?.trim().toLowerCase())
      .filter((a): a is string => Boolean(a));
    if (candidates.includes(norm)) {
      return {
        correct: true,
        score: 100,
        feedback: "To'g'ri javob.",
      };
    }
    return null;
  }

  /**
   * Pass 1: Strict-match fallback used by {@link gradeTranslation} when the
   * AI call fails. Case-insensitive trimmed equality against the canonical
   * answer (or any accepted variant). Exposed for unit testing.
   */
  static strictTranslationFallback(
    studentAnswer: string,
    correctAnswer?: string,
    acceptedAnswers?: string[],
  ): {
    correct: boolean;
    score: number;
    feedback: string;
  } {
    if (correctAnswer) {
      const match = AiService.strictTranslationMatch(
        studentAnswer,
        correctAnswer,
        acceptedAnswers,
      );
      if (match) return match;
      return {
        correct: false,
        score: 0,
        feedback: `To'g'ri javob: ${correctAnswer}`,
      };
    }
    return {
      correct: false,
      score: 0,
      feedback:
        "Javob to'g'ri kelmadi. AI baholash hozir ishlamayapti — yana urinib ko'ring.",
    };
  }

  /**
   * Pass 1: Tolerant JSON parser for grader responses. Strips Markdown
   * fences and surrounding prose, then validates the required keys. Returns
   * `null` when the response is unusable so the caller can fall back.
   */
  static parseGraderJson(raw: string): {
    correct: boolean;
    score: number;
    feedback: string;
    accepted_answers?: string[];
  } | null {
    if (!raw) return null;
    // Common Gemini wrapping: ```json ... ``` fences.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const slice = fenced ? fenced[1] : raw;
    // Snip to the first balanced { ... } block to tolerate stray text.
    const first = slice.indexOf('{');
    const last = slice.lastIndexOf('}');
    if (first < 0 || last < 0 || last <= first) return null;
    try {
      const parsed = JSON.parse(slice.slice(first, last + 1)) as {
        correct?: unknown;
        score?: unknown;
        feedback?: unknown;
        accepted_answers?: unknown;
      };
      if (
        typeof parsed.correct !== 'boolean' ||
        typeof parsed.score !== 'number' ||
        typeof parsed.feedback !== 'string'
      ) {
        return null;
      }
      const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const accepted = Array.isArray(parsed.accepted_answers)
        ? (parsed.accepted_answers.filter(
            (s) => typeof s === 'string',
          ) as string[])
        : undefined;
      return {
        correct: parsed.correct,
        score,
        feedback: parsed.feedback,
        accepted_answers: accepted,
      };
    } catch {
      return null;
    }
  }

  /**
   * Pass 1: Kid-friendly Uzbek explanation for a wrong answer. Triggered by
   * the "Tushuntirish" button (feature M) post-exercise, regardless of
   * which exercise type the student got wrong.
   *
   * Falls back to a generic Uzbek hint if Gemini is unavailable so the UI
   * never shows a hard error.
   */
  async explainAnswer(input: {
    exerciseType: string;
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    context?: string;
  }): Promise<{
    explanation: string;
    hint: string;
    examples?: string[];
  }> {
    const prompt =
      `You are a friendly English tutor for 3-7 grade students. Explain in Uzbek (the student's first language) why the answer was wrong.\n\n` +
      `EXERCISE: ${input.exerciseType}\n` +
      `QUESTION: "${input.question}"\n` +
      `STUDENT WROTE: "${input.studentAnswer}"\n` +
      `CORRECT ANSWER: "${input.correctAnswer}"\n` +
      (input.context ? `CONTEXT: ${input.context}\n` : '') +
      `\nRespond in JSON:\n` +
      `{\n` +
      `  "explanation": "2-3 sentence Uzbek explanation focusing on the rule",\n` +
      `  "hint": "1 sentence tip for next time, in Uzbek",\n` +
      `  "examples": ["1-2 similar correct examples in English"]\n` +
      `}\n\n` +
      `Tone: encouraging, kid-friendly. NEVER scold or use complex linguistics.`;

    try {
      const response = await withRetry(() =>
        this.genai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 250,
            temperature: 0.4,
          },
        }),
      );
      const text = response.text ?? '{}';
      const parsed = AiService.parseExplainJson(text);
      if (parsed) return parsed;
    } catch (err) {
      this.logger.warn(
        `explainAnswer fell back to generic hint: ${(err as Error).message}`,
      );
    }
    return {
      explanation: `To'g'ri javob: "${input.correctAnswer}". Keyingi safar yaxshiroq urinib ko'ring.`,
      hint: "Savolni diqqat bilan o'qing va kalit so'zlarga e'tibor bering.",
    };
  }

  /** Pass 1: tolerant parser for {@link explainAnswer} responses. */
  static parseExplainJson(raw: string): {
    explanation: string;
    hint: string;
    examples?: string[];
  } | null {
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const slice = fenced ? fenced[1] : raw;
    const first = slice.indexOf('{');
    const last = slice.lastIndexOf('}');
    if (first < 0 || last < 0 || last <= first) return null;
    try {
      const parsed = JSON.parse(slice.slice(first, last + 1)) as {
        explanation?: unknown;
        hint?: unknown;
        examples?: unknown;
      };
      if (
        typeof parsed.explanation !== 'string' ||
        typeof parsed.hint !== 'string'
      ) {
        return null;
      }
      const examples = Array.isArray(parsed.examples)
        ? (parsed.examples.filter((s) => typeof s === 'string') as string[])
        : undefined;
      return {
        explanation: parsed.explanation,
        hint: parsed.hint,
        examples,
      };
    } catch {
      return null;
    }
  }
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
