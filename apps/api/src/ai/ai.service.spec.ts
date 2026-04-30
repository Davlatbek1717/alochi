import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { AiService, withRetry } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusService } from '../student-status/status.service';

describe('AiService', () => {
  let service: AiService;
  const mockHttp = { post: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue('http://ai.local') };
  const mockPrisma = {} as unknown as PrismaService;
  const mockStatusService = {
    setEnglishStatus: jest.fn().mockResolvedValue({}),
  };

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
  });

  afterEach(() => jest.clearAllMocks());

  describe('scoreToStatusColor (static)', () => {
    it('low score (<50) → qizil', () => {
      expect(AiService.scoreToStatusColor(0)).toBe('qizil');
      expect(AiService.scoreToStatusColor(49)).toBe('qizil');
    });
    it('mid score (50–79) → sariq', () => {
      expect(AiService.scoreToStatusColor(50)).toBe('sariq');
      expect(AiService.scoreToStatusColor(79)).toBe('sariq');
    });
    it('high score (>=80) → yashil', () => {
      expect(AiService.scoreToStatusColor(80)).toBe('yashil');
      expect(AiService.scoreToStatusColor(100)).toBe('yashil');
    });
  });

  describe('evaluate', () => {
    it('throws ServiceUnavailable when AI service is down', async () => {
      mockHttp.post.mockReturnValue(
        throwError(() => new Error('connection refused')),
      );

      await expect(
        service.evaluate('ctx', [{ question: 'q', student_answer: 'a' }]),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockStatusService.setEnglishStatus).not.toHaveBeenCalled();
    });

    it('does NOT call setEnglishStatus when studentId omitted', async () => {
      mockHttp.post.mockReturnValue(of({ data: { score: 92 } }));
      await service.evaluate('ctx', []);
      expect(mockStatusService.setEnglishStatus).not.toHaveBeenCalled();
    });

    it('maps score=85 → yashil and calls setEnglishStatus', async () => {
      mockHttp.post.mockReturnValue(of({ data: { score: 85 } }));
      const result = await service.evaluate('ctx', [], 'student-1', 'lesson-1');

      expect(result).toEqual({ score: 85 });
      expect(mockStatusService.setEnglishStatus).toHaveBeenCalledWith(
        'student-1',
        'yashil',
        { source: 'ai_evaluation', lessonId: 'lesson-1', score: 85 },
      );
    });

    it('maps score=62 → sariq', async () => {
      mockHttp.post.mockReturnValue(of({ data: { score: 62 } }));
      await service.evaluate('ctx', [], 'student-1');
      expect(mockStatusService.setEnglishStatus).toHaveBeenCalledWith(
        'student-1',
        'sariq',
        expect.objectContaining({ score: 62 }),
      );
    });

    it('maps score=30 → qizil', async () => {
      mockHttp.post.mockReturnValue(of({ data: { score: 30 } }));
      await service.evaluate('ctx', [], 'student-1');
      expect(mockStatusService.setEnglishStatus).toHaveBeenCalledWith(
        'student-1',
        'qizil',
        expect.objectContaining({ score: 30 }),
      );
    });

    it('swallows setEnglishStatus errors so the eval response still returns', async () => {
      mockHttp.post.mockReturnValue(of({ data: { score: 90 } }));
      mockStatusService.setEnglishStatus.mockRejectedValueOnce(
        new Error('downstream boom'),
      );
      await expect(service.evaluate('ctx', [], 'student-1')).resolves.toEqual({
        score: 90,
      });
    });

    it('skips setEnglishStatus when score is missing from AI response', async () => {
      mockHttp.post.mockReturnValue(of({ data: { feedback: 'no score' } }));
      await service.evaluate('ctx', [], 'student-1');
      expect(mockStatusService.setEnglishStatus).not.toHaveBeenCalled();
    });
  });
});

describe('withRetry', () => {
  it('returns success on first try without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx and succeeds on third attempt', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockRejectedValueOnce({ response: { status: 502 } })
      .mockResolvedValueOnce('done');
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max attempts when always failing with 5xx', async () => {
    const err = { response: { status: 500 }, message: 'boom' };
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 3, 1)).rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 4xx (client error)', async () => {
    const err = { response: { status: 400 }, message: 'bad' };
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 3, 1)).rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries network errors (no response)', async () => {
    const err = { code: 'ECONNREFUSED', message: 'conn refused' };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('recovered');
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
