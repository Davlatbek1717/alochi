import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { ExamStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const GEMINI_MODEL = 'gemini-2.5-flash';

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
  private genai: GoogleGenAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.genai = new GoogleGenAI({
      apiKey: this.config.get('GEMINI_API_KEY', ''),
    });
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
    const ai = await this.askGemini(
      this.buildSystemPrompt({
        language: (exam.language as 'uz' | 'en') ?? 'en',
        aiPrompt: exam.aiPrompt ?? '',
        maxMinutes: exam.maxMinutes ?? 10,
        passThreshold: exam.passThreshold,
      }),
      transcript,
      // Force-finalize directive. The model knows the JSON shape from
      // its system prompt; this just tells it the conversation is over.
      '[END NOW] The student has indicated they are done. Finalize the exam: return your JSON with isFinal=true, a score 0-100, and the analysis breakdown.',
    );

    const score = typeof ai.score === 'number' ? ai.score : 0;
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
   * One Gemini call. Sends the system prompt + full conversation +
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
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] =
      [];
    for (const t of history) {
      contents.push({
        role: t.role === 'ai' ? 'model' : 'user',
        parts: [{ text: t.text }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: userTurn }] });

    let raw: string;
    try {
      const resp = await this.genai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction,
          temperature: 0.6,
          maxOutputTokens: 600,
          // Hint Gemini to return JSON. Some models honor this strictly.
          responseMimeType: 'application/json',
        },
      });
      raw = (resp.text ?? '').trim();
    } catch (err) {
      this.logger.error(`Gemini call failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'AI imtihon servisi vaqtincha ishlamayapti',
      );
    }

    return this.parseAiResponse(raw);
  }

  private parseAiResponse(raw: string): AiTurnResponse {
    // Strip ``` fences the model might add despite responseMimeType.
    let text = raw.trim();
    if (text.startsWith('```')) {
      text = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
    }

    try {
      const parsed = JSON.parse(text) as AiTurnResponse;
      if (typeof parsed?.message !== 'string') {
        throw new Error('missing message');
      }
      return {
        message: parsed.message,
        isFinal: Boolean(parsed.isFinal),
        score: typeof parsed.score === 'number' ? parsed.score : undefined,
        analysis: parsed.analysis ?? undefined,
      };
    } catch {
      // Fallback: treat the whole text as a continuation message. The
      // exam keeps going and the student can always tap "Tugatdim" to
      // force a final score later.
      this.logger.warn(
        `Gemini JSON parse failed, treating as plain message. Raw: ${raw.slice(0, 200)}`,
      );
      return {
        message: text || '...',
        isFinal: false,
      };
    }
  }
}
