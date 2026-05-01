import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../src/ai/ai.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StatusService } from '../src/student-status/status.service';

/**
 * Pass 1: unit tests for the new AI graders.
 *
 * The Anthropic client is wholly mocked at the instance level so we don't
 * make real API calls. We verify both the happy path (Claude returns
 * well-formed JSON) and the fallback paths (network error / malformed JSON
 * → strict-match for translation, generic Uzbek hint for explain-answer).
 */
describe('AiService — graders (Pass 1)', () => {
  let service: AiService;
  const mockHttp = { post: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue('') };
  const mockPrisma = {} as unknown as PrismaService;
  const mockStatusService = { setEnglishStatus: jest.fn() };
  const anthropicCreate = jest.fn();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: HttpService, useValue: mockHttp },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StatusService, useValue: mockStatusService },
      ],
    }).compile();
    service = module.get(AiService);
    // Replace the internal Anthropic client with a stub so no real API
    // calls escape during tests.
    (
      service as unknown as { anthropic: { messages: { create: jest.Mock } } }
    ).anthropic = {
      messages: { create: anthropicCreate },
    };
  });

  afterEach(() => jest.clearAllMocks());

  describe('parseGraderJson (static)', () => {
    it('parses a clean JSON body', () => {
      const out = AiService.parseGraderJson(
        '{"correct": true, "score": 85, "feedback": "Yaxshi", "accepted_answers": ["a","b"]}',
      );
      expect(out).toEqual({
        correct: true,
        score: 85,
        feedback: 'Yaxshi',
        accepted_answers: ['a', 'b'],
      });
    });

    it('handles ```json fenced code blocks', () => {
      const out = AiService.parseGraderJson(
        'Sure, here is the result:\n```json\n{"correct": false, "score": 30, "feedback": "Xato"}\n```',
      );
      expect(out?.correct).toBe(false);
      expect(out?.score).toBe(30);
    });

    it('clamps score to 0-100', () => {
      const out = AiService.parseGraderJson(
        '{"correct": true, "score": 250, "feedback": "x"}',
      );
      expect(out?.score).toBe(100);
    });

    it('returns null when required keys are missing', () => {
      expect(AiService.parseGraderJson('{"score": 80}')).toBeNull();
      expect(AiService.parseGraderJson('not json at all')).toBeNull();
      expect(AiService.parseGraderJson('')).toBeNull();
    });
  });

  describe('parseExplainJson (static)', () => {
    it('parses a clean JSON body', () => {
      const out = AiService.parseExplainJson(
        '{"explanation": "Sabab", "hint": "Tip", "examples": ["one"]}',
      );
      expect(out).toEqual({
        explanation: 'Sabab',
        hint: 'Tip',
        examples: ['one'],
      });
    });

    it('returns null when explanation is missing', () => {
      expect(AiService.parseExplainJson('{"hint": "tip"}')).toBeNull();
    });
  });

  describe('strictTranslationFallback (static)', () => {
    it('returns 100 when answers match (case-insensitive trim)', () => {
      const out = AiService.strictTranslationFallback('Hello', '  hello  ');
      expect(out.correct).toBe(true);
      expect(out.score).toBe(100);
    });

    it('returns 0 when answers differ', () => {
      const out = AiService.strictTranslationFallback('Hello', 'Salom');
      expect(out.correct).toBe(false);
      expect(out.score).toBe(0);
    });

    it('returns 0 when student answer is empty', () => {
      const out = AiService.strictTranslationFallback('Hello', '');
      expect(out.correct).toBe(false);
      expect(out.score).toBe(0);
    });
  });

  describe('gradeTranslation', () => {
    it('returns the parsed Claude response on success', async () => {
      anthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              correct: true,
              score: 92,
              feedback: 'Yaxshi javob',
              accepted_answers: ['I am happy', "I'm happy"],
            }),
          },
        ],
      });
      const out = await service.gradeTranslation({
        sourceText: 'Men xursandman',
        targetLanguage: 'en',
        studentAnswer: 'I am happy',
      });
      expect(out.correct).toBe(true);
      expect(out.score).toBe(92);
      expect(out.feedback).toBe('Yaxshi javob');
      expect(out.accepted_answers).toEqual(['I am happy', "I'm happy"]);
    });

    it('falls back to strict-match when Anthropic throws', async () => {
      anthropicCreate.mockRejectedValue(new Error('network down'));
      const out = await service.gradeTranslation({
        sourceText: 'Olma',
        targetLanguage: 'en',
        studentAnswer: 'apple',
        correctAnswer: 'Apple',
      });
      // Strict fallback: case-insensitive trim against correctAnswer → score 100.
      // (The fast path before the AI call also matches; either way we get 100.)
      expect(out.score).toBe(100);
      expect(out.correct).toBe(true);
    });

    it('falls back gracefully when Claude returns malformed JSON', async () => {
      anthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'I cannot grade this right now' }],
      });
      const out = await service.gradeTranslation({
        sourceText: 'Hello',
        targetLanguage: 'en',
        studentAnswer: 'something else',
      });
      expect(out.correct).toBe(false);
      expect(out.score).toBe(0);
      expect(out.feedback).toContain('urinib');
    });
  });

  describe('explainAnswer', () => {
    it('returns the parsed Claude response on success', async () => {
      anthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              explanation: "Bu yerda 'is' kerak edi",
              hint: 'Subyektga mos fe’l tanlang',
              examples: ['He is happy'],
            }),
          },
        ],
      });
      const out = await service.explainAnswer({
        exerciseType: 'translate',
        question: 'Translate: U xursand',
        studentAnswer: 'He happy',
        correctAnswer: 'He is happy',
      });
      expect(out.explanation).toContain('is');
      expect(out.hint).toContain('fe');
      expect(out.examples).toEqual(['He is happy']);
    });

    it('falls back to a generic Uzbek hint on Claude failure', async () => {
      anthropicCreate.mockRejectedValue(new Error('rate limited'));
      const out = await service.explainAnswer({
        exerciseType: 'mcq',
        question: 'q',
        studentAnswer: 'wrong',
        correctAnswer: 'right',
      });
      expect(out.explanation).toContain('right');
      expect(out.hint.length).toBeGreaterThan(0);
    });
  });

  describe('tts (multi-language)', () => {
    afterEach(() => {
      delete process.env.AZURE_SPEECH_KEY;
      delete process.env.AZURE_SPEECH_REGION;
    });

    it('returns empty placeholder when Azure creds are missing', async () => {
      const out = await service.tts('hello', 'en-US-JennyNeural', 'en');
      expect(out.audioBase64).toBe('');
      expect(out.mimeType).toBe('audio/mpeg');
    });

    it('returns empty placeholder when text is empty', async () => {
      process.env.AZURE_SPEECH_KEY = 'k';
      process.env.AZURE_SPEECH_REGION = 'r';
      const out = await service.tts('', 'en-US-JennyNeural', 'en');
      expect(out.audioBase64).toBe('');
    });
  });
});
