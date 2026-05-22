import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  chatJson,
  chatText,
  geminiHistoryToOpenAi,
  GEMINI_MODEL,
} from './llm-client';
import { StatusService } from '../student-status/status.service';
import { StatusColor } from '../student-status/status.types';
import { normalizeEnglishVariant } from './english-variant';

// Active LLM model — set in apps/api/.env via GEMINI_MODEL or defaults to
// gemini-2.5-flash. Used for tutor chat, translation grading, wrong-answer
// explanations, and error pattern analysis.
const LLM_MODEL = GEMINI_MODEL;

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

    // Direct LLM fallback (NVIDIA NIM / MiniMax-M2.7). Encourages short,
    // friendly Uzbek answers appropriate for 3-7 graders and stays within
    // the lesson context so the tutor doesn't drift off-topic.
    const messages = [
      {
        role: 'system' as const,
        content:
          "Sen 3-7 sinf o'quvchilari uchun do'stona ingliz tili o'qituvchisisan. " +
          "Javoblaringni o'zbek tilida ber, qisqa va aniq (1-3 jumla). " +
          'Iloji boricha 1-2 ta inglizcha misol qoshib, ularni qavs ichida tarjima qil. ' +
          'Amerikacha va Britaniyacha inglizchani baravar qabul qil — ikkala variant ham (color/colour, elevator/lift) toʻgʻri. ' +
          'Faqat darsdagi mavzuga oid javob ber.\n\n' +
          `DARS KONTEKSTI: ${lessonContext || 'umumiy ingliz tili savol-javobi'}`,
      },
      ...geminiHistoryToOpenAi(history),
      { role: 'user' as const, content: question },
    ];

    try {
      const text = await withRetry(() =>
        chatText(messages, {
          model: LLM_MODEL,
          maxTokens: 350,
          temperature: 0.7,
        }),
      );
      return {
        answer:
          text || 'Kechirasiz, hozir javob bera olmayman. Yana savol bering.',
      };
    } catch (err) {
      // Log server-side so an oncall sees the real cause (invalid API
      // key, quota exhausted, network), but don't 503 the student —
      // their lesson chat shouldn't pop a red error toast every time
      // a key flakes. Return the same soft fallback the empty-response
      // branch above uses; client treats this as a normal turn.
      this.logger.error(
        `askTutor: NVIDIA NIM fallback also failed. ${(err as Error).message}`,
      );
      return {
        answer:
          "Kechirasiz, AI yordamchi hozir bandh ekan. Bir-ikki daqiqadan so'ng yana urinib ko'ring.",
        degraded: true,
      };
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

  /**
   * Pronunciation Assessment via Azure Speech REST API.
   *
   * Sends the student's audio + the canonical reference text and lets
   * Azure return a per-word accuracy / fluency / completeness score.
   * Docs: https://learn.microsoft.com/azure/ai-services/speech-service/pronunciation-assessment
   *
   * Returns `{ is_correct, accuracy_score (0-100), feedback }` so the
   * existing frontend contract is preserved.
   *
   * When AZURE_SPEECH_KEY is not configured the response carries
   * `error: 'NOT_CONFIGURED'` and the frontend falls back to its
   * browser-STT scoring path. Critically, the old "always 100%"
   * fallback is gone — a missing key no longer awards a free pass.
   */
  async checkPronunciation(wordEn: string, audioBase64: string) {
    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;
    if (!azureKey || !azureRegion) {
      return {
        is_correct: null,
        accuracy_score: null,
        feedback: 'NOT_CONFIGURED',
        error: 'NOT_CONFIGURED' as const,
      };
    }

    try {
      // Pronunciation Assessment expects the score parameters as a
      // base64-encoded JSON string in the `Pronunciation-Assessment` header.
      const paParams = Buffer.from(
        JSON.stringify({
          ReferenceText: wordEn,
          GradingSystem: 'HundredMark',
          Granularity: 'Word',
          EnableMiscue: true,
        }),
      ).toString('base64');

      // Decode the data URL prefix if present, then re-encode body as bytes.
      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const audioBytes = Buffer.from(cleanBase64, 'base64');

      // Run assessment against both en-US (American) and en-GB (British)
      // in parallel and take whichever score is higher. This ensures
      // students with either accent are scored fairly.
      const assess = async (lang: string): Promise<number | null> => {
        const url =
          `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
          `?language=${lang}&format=detailed`;
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
            'Pronunciation-Assessment': paParams,
            Accept: 'application/json',
          },
          body: audioBytes,
        });
        if (!r.ok) return null;
        const d = (await r.json()) as {
          NBest?: Array<{
            PronunciationAssessment?: { PronScore?: number; AccuracyScore?: number };
          }>;
        };
        const pa = d.NBest?.[0]?.PronunciationAssessment;
        return typeof pa?.PronScore === 'number'
          ? pa.PronScore
          : typeof pa?.AccuracyScore === 'number'
            ? pa.AccuracyScore
            : null;
      };

      const [usScore, gbScore] = await Promise.all([
        assess('en-US').catch(() => null),
        assess('en-GB').catch(() => null),
      ]);

      const accuracy =
        usScore !== null && gbScore !== null
          ? Math.max(usScore, gbScore)
          : (usScore ?? gbScore);

      if (accuracy === null) {
        return {
          is_correct: null,
          accuracy_score: null,
          feedback: 'ASSESSMENT_FAILED',
          error: 'ASSESSMENT_FAILED' as const,
        };
      }

      if (accuracy === 0) {
        return {
          is_correct: false,
          accuracy_score: 0,
          feedback: 'NO_SPEECH_DETECTED',
        };
      }

      const rounded = Math.round(accuracy);
      return {
        score: rounded,
        is_correct: accuracy >= 70,
        accuracy_score: rounded,
        feedback: accuracy >= 70 ? 'OK' : 'TRY_AGAIN',
      };
    } catch (err) {
      this.logger.warn(
        `Azure Pronunciation Assessment threw: ${(err as Error).message}`,
      );
      return {
        is_correct: null,
        accuracy_score: null,
        feedback: 'ASSESSMENT_FAILED',
        error: 'ASSESSMENT_FAILED' as const,
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
      const raw = await withRetry(() =>
        chatJson(
          [
            {
              role: 'user',
              content:
                `O'quvchining quyidagi savollarda xatolari bor:\n${errorList}\n\n` +
                `Qisqa tahlil qil: 1) Zaif tomonlari (3 ta kalit so'z bilan), 2) Bitta tavsiya. ` +
                `Javobni JSON formatida ber: {"weakAreas": ["...", "..."], "recommendation": "..."}`,
            },
          ],
          {
            model: LLM_MODEL,
            maxTokens: 300,
            temperature: 0.4,
          },
        ),
      );
      // The wrapper requests json_object mode, but stay defensive in case
      // the model wraps its output in fences or stray text.
      const parsed = AiService.parseAnalyzeErrorsJson(raw || '{}');
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
   * Text-to-speech for listening / spelling / vocabulary exercises.
   *
   * Two provider paths, tried in order:
   *
   *   1. **Google Cloud Text-to-Speech** when `GEMINI_API_KEY` (or the
   *      dedicated `GOOGLE_TTS_API_KEY`) is set AND the "Cloud
   *      Text-to-Speech API" is enabled in that Google Cloud project.
   *      Same key the rest of the AI stack already uses — no separate
   *      account, no separate billing. 4M chars/month free tier.
   *
   *   2. **Azure Speech REST** when `AZURE_SPEECH_KEY` +
   *      `AZURE_SPEECH_REGION` are set. Preserved for tenants that were
   *      already on Azure.
   *
   * If neither path is configured (dev box), returns an empty buffer.
   * The lesson runner falls back to the browser's SpeechSynthesis on
   * any empty response, but Safari/iOS/Telegram in-app browsers don't
   * have that, which is the user-visible "audio mavjud emas" symptom
   * this method now closes by talking to Google directly.
   *
   * Returns base64-encoded MP3.
   */
  async tts(
    text: string,
    voiceOrLanguage: string = 'en-US-JennyNeural',
    language?: 'en' | 'uz',
    accent: 'us' | 'uk' = 'us',
  ): Promise<{
    audioBase64: string;
    mimeType: string;
  }> {
    if (!text) return { audioBase64: '', mimeType: 'audio/mpeg' };

    const lang = language ?? 'en';
    // English locale tag — students learn both American and British English,
    // so the caller can request either accent. Uzbek ignores accent.
    const enLocale = accent === 'uk' ? 'en-GB' : 'en-US';

    // ── Path 1: Google Cloud Text-to-Speech ────────────────────────────
    const googleKey =
      process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
    if (googleKey) {
      // Voice picks: WaveNet for English (warm + natural) and Standard
      // for Uzbek (only voice family Cloud TTS exposes for uz-UZ at the
      // moment). The default English voice mirrors Azure's "Jenny" choice
      // — a friendly young-adult female reader — so existing copy aimed
      // at kids still feels right.
      const googleVoice =
        lang === 'uz'
          ? 'uz-UZ-Standard-A'
          : accent === 'uk'
            ? 'en-GB-Wavenet-A'
            : 'en-US-Wavenet-F';
      const languageCode = lang === 'uz' ? 'uz-UZ' : enLocale;
      try {
        const res = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text },
              voice: { languageCode, name: googleVoice },
              audioConfig: {
                audioEncoding: 'MP3',
                // Slightly slower so kids can keep up.
                speakingRate: 0.95,
              },
            }),
          },
        );
        if (res.ok) {
          const data = (await res.json()) as { audioContent?: string };
          if (data.audioContent) {
            return {
              audioBase64: data.audioContent,
              mimeType: 'audio/mpeg',
            };
          }
        } else {
          // Log once so ops can see WHY we fell through (most common:
          // "Cloud Text-to-Speech API has not been used in project
          // ... before or it is disabled" — fix is one click in the
          // Cloud console).
          const body = await res.text().catch(() => '');
          this.logger.warn(
            `Google TTS ${res.status} — falling through. ${body.slice(0, 200)}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Google TTS threw, falling through: ${(err as Error).message}`,
        );
      }
    }

    // ── Path 2: Google Translate TTS (unofficial, no key) ─────────────
    // Free fallback used by countless open-source TTS libraries for the
    // past decade. No API key required — the same endpoint the
    // translate.google.com page itself hits. Voice quality is "ok" (not
    // WaveNet), but it makes Listen exercises and word audio work in
    // Safari, Firefox, and Telegram in-app browsers that lack
    // SpeechSynthesis even before the operator enables Cloud TTS.
    //
    // Hard 200-char per-request limit on Google's side — we chunk longer
    // text on sentence/word boundaries and concatenate the MP3 frames.
    // Most lesson sentences fit in one request.
    try {
      const ttsLang =
        lang === 'uz' ? 'uz' : accent === 'uk' ? 'en-GB' : 'en';
      const chunks = splitForTranslateTts(text);
      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        const url =
          `https://translate.google.com/translate_tts?ie=UTF-8` +
          `&q=${encodeURIComponent(chunk)}` +
          `&tl=${ttsLang}&client=tw-ob`;
        const res = await fetch(url, {
          headers: {
            // The endpoint 403s without a real-browser UA.
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
              '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': ttsLang === 'uz' ? 'uz,en;q=0.9' : 'en;q=0.9',
            Referer: 'https://translate.google.com/',
          },
        });
        if (!res.ok) {
          this.logger.warn(
            `Translate TTS chunk ${res.status} — falling through.`,
          );
          buffers.length = 0;
          break;
        }
        const chunkBuf = Buffer.from(await res.arrayBuffer());
        // Translate TTS returns HTTP 204 with a 0-byte body for languages
        // it doesn't dub (uz being the main one we hit). Treat that as a
        // miss so we fall through to Azure instead of returning silence.
        if (chunkBuf.length === 0) {
          this.logger.warn(
            `Translate TTS returned empty body for lang=${ttsLang}.`,
          );
          buffers.length = 0;
          break;
        }
        buffers.push(chunkBuf);
      }
      if (buffers.length > 0) {
        const merged = Buffer.concat(buffers);
        return {
          audioBase64: merged.toString('base64'),
          mimeType: 'audio/mpeg',
        };
      }
    } catch (err) {
      this.logger.warn(
        `Translate TTS threw, falling through: ${(err as Error).message}`,
      );
    }

    // ── Path 3: Azure Speech ──────────────────────────────────────────
    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;
    if (!azureKey || !azureRegion) {
      return { audioBase64: '', mimeType: 'audio/mpeg' };
    }

    const defaultVoice =
      lang === 'uz'
        ? 'uz-UZ-MadinaNeural'
        : accent === 'uk'
          ? 'en-GB-LibbyNeural'
          : 'en-US-JennyNeural';
    const voice =
      voiceOrLanguage && voiceOrLanguage !== 'en-US-JennyNeural'
        ? voiceOrLanguage
        : defaultVoice;
    const xmlLang = lang === 'uz' ? 'uz-UZ' : enLocale;

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
      `- Accept BOTH American and British English equally — spelling (color/colour, organize/organise, center/centre) AND vocabulary (elevator/lift, candy/sweets, soccer/football). NEVER mark an answer wrong just because it uses the other variant; both score 100.\n` +
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
      const text = await withRetry(() =>
        chatJson(
          [{ role: 'user', content: prompt }],
          {
            model: LLM_MODEL,
            maxTokens: 200,
            temperature: 0.2,
          },
        ),
      );
      const parsed = AiService.parseGraderJson(text || '{}');
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
    const norm = normalizeEnglishVariant(studentAnswer);
    if (!norm) return null;
    // Normalise candidates the same way so US/UK spelling variants
    // (color/colour, organize/organise) both match the canonical answer.
    const candidates = [correctAnswer, ...(acceptedAnswers ?? [])]
      .filter((a): a is string => Boolean(a && a.trim()))
      .map((a) => normalizeEnglishVariant(a));
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
      `\nIMPORTANT: Both American and British English are correct. If the only difference is US/UK spelling (color/colour) or vocabulary (elevator/lift), the student is NOT wrong — say it is also accepted instead of explaining an error.\n` +
      `\nRespond in JSON:\n` +
      `{\n` +
      `  "explanation": "2-3 sentence Uzbek explanation focusing on the rule",\n` +
      `  "hint": "1 sentence tip for next time, in Uzbek",\n` +
      `  "examples": ["1-2 similar correct examples in English"]\n` +
      `}\n\n` +
      `Tone: encouraging, kid-friendly. NEVER scold or use complex linguistics.`;

    try {
      const text = await withRetry(() =>
        chatJson(
          [{ role: 'user', content: prompt }],
          {
            model: LLM_MODEL,
            maxTokens: 250,
            temperature: 0.4,
          },
        ),
      );
      const parsed = AiService.parseExplainJson(text || '{}');
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

  /**
   * Student-facing translator tool (/student/translate). Plain text
   * translation between Uzbek and English via Gemini. Returns the
   * translation plus an optional one-line note (used to surface
   * idiomatic / kid-friendly hints when the literal translation would
   * be misleading). The DTO caps text at 2000 chars so a single call
   * stays inside the model's context budget.
   */
  async translateText(input: {
    text: string;
    fromLang: 'uz' | 'en';
    toLang: 'uz' | 'en';
  }): Promise<{ translation: string; note?: string }> {
    const trimmed = input.text.trim();
    if (!trimmed) return { translation: '' };
    if (input.fromLang === input.toLang) {
      return { translation: trimmed };
    }

    const fromName = input.fromLang === 'uz' ? 'Uzbek' : 'English';
    const toName = input.toLang === 'uz' ? 'Uzbek' : 'English';

    const prompt =
      `You are an experienced ${fromName}↔${toName} translator for ` +
      `Uzbek 3-7 grade students learning English.\n\n` +
      `TASK: translate the following ${fromName} text into natural, ` +
      `kid-appropriate ${toName}. Keep the same register (formal/informal). ` +
      `Preserve names, numbers, punctuation. If a word is ambiguous, ` +
      `pick the most common school-context meaning.\n\n` +
      `SOURCE (${fromName}):\n${trimmed}\n\n` +
      `Respond in JSON only:\n` +
      `{\n` +
      `  "translation": "<your ${toName} translation>",\n` +
      `  "note": "<optional 1-sentence Uzbek note about an idiom or alternative — omit when literal translation is fine>"\n` +
      `}`;

    try {
      const raw = await withRetry(() =>
        chatJson(
          [{ role: 'user', content: prompt }],
          { model: LLM_MODEL, temperature: 0.3, maxTokens: 1024 },
        ),
      );
      const parsed = AiService.parseTranslateJson(raw || '{}');
      if (parsed) return parsed;
    } catch (err) {
      this.logger.warn(
        `translateText failed, returning empty: ${(err as Error).message}`,
      );
    }
    return { translation: '' };
  }

  /** Tolerant parser for {@link translateText}. */
  static parseTranslateJson(raw: string): {
    translation: string;
    note?: string;
  } | null {
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const slice = fenced ? fenced[1] : raw;
    const first = slice.indexOf('{');
    const last = slice.lastIndexOf('}');
    if (first < 0 || last < 0 || last <= first) return null;
    try {
      const parsed = JSON.parse(slice.slice(first, last + 1)) as {
        translation?: unknown;
        note?: unknown;
      };
      if (typeof parsed.translation !== 'string') return null;
      const out: { translation: string; note?: string } = {
        translation: parsed.translation,
      };
      if (typeof parsed.note === 'string' && parsed.note.trim()) {
        out.note = parsed.note.trim();
      }
      return out;
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

/**
 * Split text for the unofficial Google Translate TTS endpoint, which
 * enforces a hard 200-character limit per request. Splits on sentence
 * boundaries first (`. ! ?`), then on word boundaries, never mid-word.
 * Returns the original string in a single-element array when it's
 * already under the limit, which is the common case.
 */
function splitForTranslateTts(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  const LIMIT = 200;
  if (trimmed.length <= LIMIT) return [trimmed];

  const out: string[] = [];
  // First pass: sentence-level split. Keep the punctuation attached to
  // the preceding sentence so playback rhythm matches the written text.
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (sentence.length <= LIMIT) {
      out.push(sentence);
      continue;
    }
    // Second pass: word-level greedy fill so long sentences split on
    // whitespace rather than mid-word, which Translate TTS pronounces
    // awkwardly.
    const words = sentence.split(/\s+/);
    let buf = '';
    for (const word of words) {
      const next = buf ? `${buf} ${word}` : word;
      if (next.length > LIMIT) {
        if (buf) out.push(buf);
        buf = word.length > LIMIT ? word.slice(0, LIMIT) : word;
      } else {
        buf = next;
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}
