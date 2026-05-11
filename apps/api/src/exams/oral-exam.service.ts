import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExamStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { chatJson, GEMINI_MODEL } from '../ai/llm-client';

const LLM_MODEL = GEMINI_MODEL;

export interface ConversationTurn {
  role: 'ai' | 'student';
  text: string;
  ts: string;
}

export interface AiTurnResponse {
  message: string;
  isFinal: boolean;
  score?: number;
  analysis?: {
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
  };
}

/**
 * AI-driven oral exam — student speaks via mic, AI conducts the exam
 * in Uzbek or English (per Exam.language), evaluates speaking ability
 * end-to-end via Gemini, and writes back a 0-100 score plus pass/fail.
 *
 * Architecture: stateless server (path 1 — browser-only). The browser
 * does STT + TTS via Web Speech API. The server only proxies LLM calls
 * and persists the transcript. Each `respond()` call sends the full
 * conversation history back to Gemini, gets a JSON-shaped response,
 * appends both turns to the transcript.
 */
@Injectable()
export class OralExamService {
  private readonly logger = new Logger(OralExamService.name);
  /**
   * Pool of Gemini API keys. `GEMINI_API_KEY` accepts a comma-separated
   * list — every key gets its own quota bucket and we rotate through them
   * as each hits its limit. Add more keys (separate Google AI Studio
   * projects) to raise the daily request cap.
   */
  private apiKeys: string[];
  /** Last key that succeeded — start the next call there to keep
   *  warm responses on the same project. */
  private lastGoodIdx = 0;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const raw = this.config.get<string>('GEMINI_API_KEY', '') ?? '';
    this.apiKeys = raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (this.apiKeys.length === 0) {
      this.logger.warn(
        'GEMINI_API_KEY is empty — oral exam start will return 503 until set.',
      );
      // Keep one empty entry so the rest of the code path is uniform;
      // it'll fail with a clear "no key" error when a request comes in.
      this.apiKeys = [''];
    } else {
      this.logger.log(
        `Oral exam Gemini pool configured with ${this.apiKeys.length} key(s).`,
      );
    }
  }

  /**
   * Build the system instruction telling Gemini how to behave during
   * an oral exam. The model is asked to respond in JSON so the server
   * can reliably extract the next turn's text and the eventual final
   * verdict.
   */
  private buildSystemPrompt(input: {
    language: 'uz' | 'en';
    aiPrompt: string;
    maxMinutes: number;
    passThreshold: number;
  }): string {
    const langName = input.language === 'uz' ? 'Uzbek' : 'English';
    return `You are an experienced ${langName} language teacher conducting an ORAL exam with a student.

EXAM INSTRUCTIONS (from the teacher who created this exam):
${input.aiPrompt}

CONVERSATION RULES:
1. Speak ONLY in ${langName}. Do not switch languages mid-exam.
2. Keep your turns SHORT — 1-2 sentences. This is a spoken exam.
3. Ask 3-5 substantive questions matching the instructions above.
4. After each student response, briefly acknowledge then continue.
5. Wrap up around the ${input.maxMinutes}-minute mark or when you have enough evidence to grade.
6. The student may say "Tugatdim" / "I'm done" — accept and finalize.

OUTPUT FORMAT — return STRICT JSON only, no markdown fences, no commentary:
{
  "message": "<your next thing to say to the student, in ${langName}>",
  "isFinal": false,
  "score": null,
  "analysis": null
}

When you decide to END the exam (after enough conversation), return:
{
  "message": "<a short closing line in ${langName}>",
  "isFinal": true,
  "score": <integer 0-100 — see grading rubric below>,
  "analysis": {
    "strengths": ["<short bullet>", "..."],
    "weaknesses": ["<short bullet>", "..."],
    "recommendations": ["<short bullet>", "..."]
  }
}

GRADING RUBRIC (0-100):
  - Grammar correctness     (0-25)
  - Vocabulary range        (0-25)
  - Fluency / pronunciation (0-25)
  - Comprehension / relevance to question (0-25)

PASS THRESHOLD: ${input.passThreshold}% — score >= threshold means passed.
Be fair but realistic. A beginner answering haltingly can still pass with ~70 if they understand and respond appropriately.`;
  }

  /**
   * Start an oral exam session for the given permission. Idempotent:
   * if an active session already exists, returns its current state
   * with the LAST AI turn so the student can resume.
   */
  async start(examPermissionId: string, studentId: string) {
    const permission = await this.prisma.examPermission.findUnique({
      where: { id: examPermissionId },
      include: { exam: true },
    });
    if (!permission) throw new NotFoundException('Imtihon ruxsati topilmadi');
    if (permission.studentId !== studentId) throw new ForbiddenException();
    if (permission.status !== ExamStatus.active) {
      throw new BadRequestException('Imtihon allaqachon yakunlangan');
    }
    const exam = permission.exam;
    if (!exam || exam.kind !== 'ai_oral') {
      throw new BadRequestException("Bu imtihon AI og'zaki turida emas");
    }
    if (!exam.aiPrompt?.trim()) {
      throw new BadRequestException('AI imtihonida prompt sozlanmagan');
    }

    // If an active session exists, resume it. If a completed/expired
    // session exists but the permission was just re-granted (status is
    // active), drop the stale session so the student can start fresh.
    const existing = await this.prisma.oralExamSession.findUnique({
      where: { examPermissionId },
    });
    if (existing) {
      if (existing.status === 'active') {
        return this.resumePayload(existing, exam);
      }
      // Permission is active but the prior session is completed —
      // tester re-granted. Wipe the stale row so we can create fresh.
      await this.prisma.oralExamSession.delete({ where: { id: existing.id } });
    }

    // Fresh session — ask Gemini for the opening line.
    const opener = await this.askGemini(
      this.buildSystemPrompt({
        language: (exam.language as 'uz' | 'en') ?? 'en',
        aiPrompt: exam.aiPrompt,
        maxMinutes: exam.maxMinutes ?? 10,
        passThreshold: exam.passThreshold,
      }),
      [],
      // Bootstrap: tell the model to greet the student and ask the
      // first question. We send this as a synthetic user turn so the
      // generation API has something to respond to.
      '[BEGIN] Greet the student and ask your first question now.',
    );

    const transcript: ConversationTurn[] = [
      { role: 'ai', text: opener.message, ts: new Date().toISOString() },
    ];

    // Race-safe create: in dev (HMR + React strict mode), `start()`
    // can be invoked twice in parallel before either persists. The
    // unique constraint on examPermissionId then fails the loser. If
    // that happens, refetch the winner's row and resume from it
    // instead of bubbling the 500 to the student.
    try {
      const session = await this.prisma.oralExamSession.create({
        data: {
          examPermissionId,
          examId: exam.id,
          studentId,
          status: 'active',
          transcript: transcript as unknown as object,
        },
      });
      return {
        sessionId: session.id,
        transcript,
        message: opener.message,
        isFinal: false,
        language: exam.language,
        maxMinutes: exam.maxMinutes,
      };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        const winner = await this.prisma.oralExamSession.findUnique({
          where: { examPermissionId },
        });
        if (winner) return this.resumePayload(winner, exam);
      }
      throw err;
    }
  }

  /**
   * Build a "resume" response from an existing session row. Used when
   * the student reloads mid-exam OR when a parallel `start()` call lost
   * the create race and we recover by reading the winner's session.
   */
  private resumePayload(
    existing: { id: string; transcript: unknown },
    exam: { language: string | null; maxMinutes: number | null },
  ) {
    const transcript = (existing.transcript as ConversationTurn[]) ?? [];
    const lastAi = [...transcript].reverse().find((t) => t.role === 'ai');
    return {
      sessionId: existing.id,
      transcript,
      message: lastAi?.text ?? this.firstAiLine(exam.language as 'uz' | 'en'),
      isFinal: false,
      language: exam.language,
      maxMinutes: exam.maxMinutes,
    };
  }

  /**
   * Append the student's turn, get the next AI turn (or a final
   * verdict), persist, and return.
   */
  async respond(
    examPermissionId: string,
    studentId: string,
    studentText: string,
  ) {
    const trimmed = studentText.trim();
    if (!trimmed) throw new BadRequestException("Bo'sh javob");

    const session = await this.prisma.oralExamSession.findUnique({
      where: { examPermissionId },
      include: {
        exam: true,
        permission: true,
      },
    });
    if (!session) throw new NotFoundException('Sessiya topilmadi');
    if (session.studentId !== studentId) throw new ForbiddenException();
    if (session.status !== 'active') {
      throw new BadRequestException('Sessiya yakunlangan');
    }

    const transcript =
      (session.transcript as unknown as ConversationTurn[]) ?? [];
    transcript.push({
      role: 'student',
      text: trimmed,
      ts: new Date().toISOString(),
    });

    const exam = session.exam;
    const ai = await this.askGemini(
      this.buildSystemPrompt({
        language: (exam.language as 'uz' | 'en') ?? 'en',
        aiPrompt: exam.aiPrompt ?? '',
        maxMinutes: exam.maxMinutes ?? 10,
        passThreshold: exam.passThreshold,
      }),
      transcript.slice(0, -1), // history before this student turn
      trimmed,
    );

    transcript.push({
      role: 'ai',
      text: ai.message,
      ts: new Date().toISOString(),
    });

    if (ai.isFinal && typeof ai.score === 'number') {
      await this.finalizeSession(
        session.id,
        ai,
        transcript,
        session.examPermissionId,
      );
      return {
        sessionId: session.id,
        transcript,
        message: ai.message,
        isFinal: true,
        score: ai.score,
        passed: ai.score >= exam.passThreshold,
        analysis: ai.analysis ?? null,
      };
    }

    await this.prisma.oralExamSession.update({
      where: { id: session.id },
      data: { transcript: transcript as unknown as object },
    });

    return {
      sessionId: session.id,
      transcript,
      message: ai.message,
      isFinal: false,
    };
  }

  /**
   * Force the AI to wrap up — student tapped "Tugatdim". Sends a
   * final-evaluation prompt to Gemini and writes the score.
   */
  async finalize(examPermissionId: string, studentId: string) {
    const session = await this.prisma.oralExamSession.findUnique({
      where: { examPermissionId },
      include: { exam: true },
    });
    if (!session) throw new NotFoundException('Sessiya topilmadi');
    if (session.studentId !== studentId) throw new ForbiddenException();
    if (session.status !== 'active') {
      // Already finalized — return current result.
      return {
        sessionId: session.id,
        score: session.score ?? 0,
        passed: session.passed ?? false,
        analysis: session.aiAnalysis,
        message: '',
        isFinal: true,
      };
    }

    const transcript =
      (session.transcript as unknown as ConversationTurn[]) ?? [];
    const exam = session.exam;
    let ai = await this.askGemini(
      this.buildSystemPrompt({
        language: (exam.language as 'uz' | 'en') ?? 'en',
        aiPrompt: exam.aiPrompt ?? '',
        maxMinutes: exam.maxMinutes ?? 10,
        passThreshold: exam.passThreshold,
      }),
      transcript,
      // Force-finalize directive — stronger wording so the model
      // doesn't slip back into conversation mode and skip the verdict.
      'STOP. Do NOT continue the conversation. The student is finished. ' +
        'Return ONLY the final-grade JSON with isFinal=true, an integer ' +
        '"score" between 0 and 100 (per the rubric), and the analysis ' +
        'object. Do not greet, do not ask another question.',
    );

    // If the model didn't deliver a score (truncated, ignored the
    // STOP), one tighter retry asking only for the verdict JSON.
    if (typeof ai.score !== 'number') {
      this.logger.warn(
        'Finalize first attempt missing score — retrying with strict prompt.',
      );
      try {
        const retry = await this.askGemini(
          this.buildSystemPrompt({
            language: (exam.language as 'uz' | 'en') ?? 'en',
            aiPrompt: exam.aiPrompt ?? '',
            maxMinutes: exam.maxMinutes ?? 10,
            passThreshold: exam.passThreshold,
          }),
          transcript,
          'EVALUATE NOW. Output ONLY this JSON shape and nothing else: ' +
            '{"message":"<one-line closing in ' +
            (exam.language === 'uz' ? 'Uzbek' : 'English') +
            '>","isFinal":true,"score":<integer 0-100>,' +
            '"analysis":{"strengths":[],"weaknesses":[],"recommendations":[]}}',
        );
        if (typeof retry.score === 'number') {
          ai = retry;
        }
      } catch (err) {
        this.logger.warn(`Finalize retry failed: ${(err as Error).message}`);
      }
    }

    // Final guardrail: if the score still isn't a number, give the
    // student the benefit of the doubt and award the pass threshold
    // (so a flaky LLM turn doesn't auto-fail them).
    const score =
      typeof ai.score === 'number'
        ? Math.max(0, Math.min(100, Math.round(ai.score)))
        : exam.passThreshold;
    transcript.push({
      role: 'ai',
      text:
        ai.message ||
        (exam.language === 'uz' ? 'Imtihon yakunlandi.' : 'Exam ended.'),
      ts: new Date().toISOString(),
    });

    await this.finalizeSession(
      session.id,
      { ...ai, score },
      transcript,
      examPermissionId,
    );

    return {
      sessionId: session.id,
      score,
      passed: score >= exam.passThreshold,
      analysis: ai.analysis ?? null,
      message: ai.message,
      isFinal: true,
    };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async finalizeSession(
    sessionId: string,
    ai: AiTurnResponse,
    transcript: ConversationTurn[],
    examPermissionId: string,
  ) {
    const score =
      typeof ai.score === 'number'
        ? Math.max(0, Math.min(100, Math.round(ai.score)))
        : 0;

    // Pull the threshold off the related exam in one query.
    const session = await this.prisma.oralExamSession.findUnique({
      where: { id: sessionId },
      include: { exam: true },
    });
    const passThreshold = session?.exam?.passThreshold ?? 70;
    const passed = score >= passThreshold;

    await this.prisma.$transaction([
      this.prisma.oralExamSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          transcript: transcript as unknown as object,
          aiAnalysis: (ai.analysis ?? null) as unknown as object,
          score,
          passed,
          completedAt: new Date(),
        },
      }),
      this.prisma.examPermission.update({
        where: { id: examPermissionId },
        data: {
          status: passed ? ExamStatus.done : ExamStatus.failed,
          score,
          passed,
          completedAt: new Date(),
        },
      }),
    ]);
  }

  private firstAiLine(language: 'uz' | 'en'): string {
    return language === 'uz'
      ? 'Salom! Imtihonni boshlaymiz.'
      : "Hello! Let's begin the exam.";
  }

  /**
   * One NVIDIA NIM call. Sends the system prompt + full conversation +
   * the latest user turn, parses the model's JSON output.
   *
   * Robustness: if the model wraps the JSON in markdown fences, we
   * strip them; if it falls back to plain prose (rare), we treat the
   * whole text as `message` and assume the conversation continues.
   */
  private async askGemini(
    systemInstruction: string,
    history: ConversationTurn[],
    userTurn: string,
  ): Promise<AiTurnResponse> {
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemInstruction },
    ];
    for (const t of history) {
      messages.push({
        role: t.role === 'ai' ? 'assistant' : 'user',
        content: t.text,
      });
    }
    messages.push({ role: 'user', content: userTurn });

    // Try every configured key in rotation, starting from the last
    // one that worked. The first key whose call doesn't trip a quota
    // wins; we remember it so the next request starts there too.
    const errors: string[] = [];
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const idx = (this.lastGoodIdx + attempt) % this.apiKeys.length;
      const key = this.apiKeys[idx];
      if (!key) {
        errors.push(`key#${idx}: empty`);
        continue;
      }
      try {
        const raw = (
          await chatJson(messages, {
            model: LLM_MODEL,
            apiKey: key,
            temperature: 0.6,
            // 1500 leaves enough room for the full final JSON
            // (message + 3-5 strengths + weaknesses + recommendations)
            // without truncation.
            maxTokens: 1500,
          })
        ).trim();
        this.lastGoodIdx = idx;
        return this.parseAiResponse(raw);
      } catch (err) {
        const msg = (err as Error).message ?? '';
        const isQuota =
          msg.includes('rate_limit') ||
          msg.includes('rate limit') ||
          msg.includes('quota') ||
          msg.includes('429');
        const isAuth =
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('API key') ||
          msg.includes('Unauthorized') ||
          msg.includes('invalid_api_key');

        // Quota / auth on this key → try the next one. Other failures
        // (network, parse) bubble out — retrying probably won't help
        // and we don't want to burn extra keys on a 5xx that hits
        // every project alike.
        if (isQuota || isAuth) {
          this.logger.warn(
            `NVIDIA NIM key#${idx} ${isQuota ? 'quota' : 'auth'} fail — trying next.`,
          );
          errors.push(
            `key#${idx}: ${isQuota ? 'quota' : 'auth'} (${msg.slice(0, 80)})`,
          );
          continue;
        }
        this.logger.error(`NVIDIA NIM call failed (non-rotating): ${msg}`);
        throw new ServiceUnavailableException(
          'AI imtihon servisi vaqtincha ishlamayapti. Birozdan keyin urinib ' +
            "ko'ring.",
        );
      }
    }

    // All keys tripped quota or auth.
    this.logger.error(
      `All ${this.apiKeys.length} NVIDIA NIM key(s) exhausted: ${errors.join('; ')}`,
    );
    const allQuota = errors.every((e) => e.includes('quota'));
    throw new ServiceUnavailableException(
      allQuota
        ? "AI imtihon barcha API kalitlar chegaraga yetgan. Administratorga GEMINI_API_KEY ga yana bir kalit qo'shish haqida xabar bering."
        : 'AI imtihon servisining kalitlari yaroqsiz. Administratorga xabar bering.',
    );
  }

  /**
   * Robust JSON extractor for Gemini's `application/json` responses.
   * Handles three failure modes seen in production:
   *
   *   1. Markdown fences ```json ... ``` — strip them.
   *   2. Surrounding prose (model added a preamble) — find the first
   *      balanced {...} substring.
   *   3. Truncated JSON (output token cap clipped mid-string) — try to
   *      regex-extract the message + score from the partial text and
   *      synthesize a usable response so the student never sees raw
   *      JSON in the result screen.
   */
  private parseAiResponse(raw: string): AiTurnResponse {
    let text = raw.trim();
    if (text.startsWith('```')) {
      text = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
    }

    // Strategy 1 — direct parse of the whole text.
    const direct = this.tryParseJson(text);
    if (direct) return direct;

    // Strategy 2 — find the first balanced {...} substring. Helpful
    // when the model wrote a preamble before the JSON.
    const slice = this.extractBalancedJsonObject(text);
    if (slice) {
      const parsed = this.tryParseJson(slice);
      if (parsed) return parsed;
    }

    // Strategy 3 — the JSON was likely truncated. Salvage what we can
    // via regex: a `"message": "..."` substring and a `"score": N`
    // substring. Better to surface a plausible message than to dump
    // raw JSON onto the result screen.
    const messageMatch = /"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(text);
    const scoreMatch = /"score"\s*:\s*(\d+)/.exec(text);
    const isFinalMatch = /"isFinal"\s*:\s*(true|false)/.exec(text);
    const fallbackMessage = messageMatch?.[1]
      ? this.unescapeJsonString(messageMatch[1])
      : '';
    const fallbackScore = scoreMatch ? Number(scoreMatch[1]) : undefined;
    const fallbackIsFinal = isFinalMatch?.[1] === 'true';

    if (fallbackMessage || typeof fallbackScore === 'number') {
      this.logger.warn(
        `Gemini JSON truncated/malformed; salvaged via regex. Raw: ${raw.slice(0, 200)}`,
      );
      return {
        message: fallbackMessage || '...',
        isFinal: fallbackIsFinal,
        score: fallbackScore,
      };
    }

    // Strategy 4 — give up on parsing; treat the entire response as a
    // plain conversational message and keep the exam going. Don't
    // declare it final, don't dump JSON to the user.
    this.logger.warn(
      `Gemini JSON parse failed entirely. Raw: ${raw.slice(0, 200)}`,
    );
    return {
      message: text.replace(/[{}"]+/g, '').trim() || '...',
      isFinal: false,
    };
  }

  private tryParseJson(text: string): AiTurnResponse | null {
    try {
      const parsed = JSON.parse(text) as AiTurnResponse;
      if (typeof parsed?.message !== 'string') return null;
      return {
        message: parsed.message,
        isFinal: Boolean(parsed.isFinal),
        score: typeof parsed.score === 'number' ? parsed.score : undefined,
        analysis: parsed.analysis ?? undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Find the first balanced `{...}` substring in `text`, respecting
   * string escapes so quotes inside string values don't confuse the
   * brace counter. Returns null if no balanced object is found.
   */
  private extractBalancedJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  /** Decode a partial JSON-escaped string captured by the salvage regex. */
  private unescapeJsonString(s: string): string {
    return s
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}
