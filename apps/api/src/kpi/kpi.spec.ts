import { Test } from '@nestjs/testing';
import { KpiService } from './kpi.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  kpiScore: {
    create: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('KpiService', () => {
  let service: KpiService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [KpiService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(KpiService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('award', () => {
    it('creates a kpi score record', async () => {
      const dto = { tenantId: 't1', userId: 'u1', score: 10, reason: 'lesson' };
      const record = { id: 'kpi-1', ...dto, date: new Date() };
      mockPrisma.kpiScore.create.mockResolvedValue(record);

      const result = await service.award(dto);

      expect(result).toEqual(record);
      expect(mockPrisma.kpiScore.create).toHaveBeenCalledTimes(1);
      const callData = mockPrisma.kpiScore.create.mock.calls[0][0].data;
      expect(callData.userId).toBe('u1');
      expect(callData.score).toBe(10);
      expect(callData.reason).toBe('lesson');
    });

    it('passes optional taskId and delegationId when provided', async () => {
      const dto = {
        tenantId: 't1',
        userId: 'u1',
        score: 5,
        reason: 'task',
        taskId: 'task-1',
        delegationId: 'del-1',
      };
      mockPrisma.kpiScore.create.mockResolvedValue({ id: 'kpi-2', ...dto });

      await service.award(dto);

      const callData = mockPrisma.kpiScore.create.mock.calls[0][0].data;
      expect(callData.taskId).toBe('task-1');
      expect(callData.delegationId).toBe('del-1');
    });
  });

  describe('getDailyTotal', () => {
    it('returns the summed score for the day', async () => {
      mockPrisma.kpiScore.aggregate.mockResolvedValue({ _sum: { score: 35 } });

      const total = await service.getDailyTotal('u1', new Date('2026-04-25'));

      expect(total).toBe(35);
      expect(mockPrisma.kpiScore.aggregate).toHaveBeenCalledTimes(1);
    });

    it('returns 0 when there are no scores for the day', async () => {
      mockPrisma.kpiScore.aggregate.mockResolvedValue({
        _sum: { score: null },
      });

      const total = await service.getDailyTotal('u1', new Date('2026-04-25'));

      expect(total).toBe(0);
    });

    it('queries within the correct day boundaries', async () => {
      mockPrisma.kpiScore.aggregate.mockResolvedValue({ _sum: { score: 0 } });
      const date = new Date('2026-04-25T12:00:00Z');

      await service.getDailyTotal('u1', date);

      const whereClause = mockPrisma.kpiScore.aggregate.mock.calls[0][0].where;
      expect(whereClause.date.gte.getHours()).toBe(0);
      expect(whereClause.date.lte.getHours()).toBe(23);
    });
  });

  describe('getMonthlyTotal', () => {
    it('returns the summed score for the month', async () => {
      mockPrisma.kpiScore.aggregate.mockResolvedValue({ _sum: { score: 120 } });

      const total = await service.getMonthlyTotal('u1', 2026, 4);

      expect(total).toBe(120);
    });

    it('returns 0 when there are no scores for the month', async () => {
      mockPrisma.kpiScore.aggregate.mockResolvedValue({
        _sum: { score: null },
      });

      const total = await service.getMonthlyTotal('u1', 2026, 4);

      expect(total).toBe(0);
    });
  });

  describe('hasAwardInRange', () => {
    it('returns true when an award exists in the range', async () => {
      mockPrisma.kpiScore.findFirst.mockResolvedValue({ id: 'k1' });
      const result = await service.hasAwardInRange(
        'u1',
        'auto_mentor_daily',
        new Date('2026-04-30T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z'),
      );
      expect(result).toBe(true);
    });

    it('returns false when no award exists in the range', async () => {
      mockPrisma.kpiScore.findFirst.mockResolvedValue(null);
      const result = await service.hasAwardInRange(
        'u1',
        'auto_mentor_daily',
        new Date(),
        new Date(),
      );
      expect(result).toBe(false);
    });

    it('queries by userId, reason and date range', async () => {
      mockPrisma.kpiScore.findFirst.mockResolvedValue(null);
      const start = new Date('2026-04-01');
      const end = new Date('2026-04-30');
      await service.hasAwardInRange('u1', 'filadmin_monthly_bonus', start, end);
      const call = mockPrisma.kpiScore.findFirst.mock.calls[0][0];
      expect(call.where.userId).toBe('u1');
      expect(call.where.reason).toBe('filadmin_monthly_bonus');
      expect(call.where.date.gte).toBe(start);
      expect(call.where.date.lte).toBe(end);
    });
  });

  describe('computeMentorDaily (§8.1)', () => {
    it('caps each row at +5 ball — full target hit on every input', () => {
      const r = service.computeMentorDaily({
        studentsTaught: 25, // capped at 20 → 5 ball
        durationMinutes: 30, // ≥ 15 → 5 ball
        scoresGiven: 25, // capped at 20 → 5 ball
        redNotified: 1, // ≥ 1 → 5 ball
      });
      expect(r.cappedStudents).toBe(20);
      expect(r.totalScore).toBe(20);
    });

    it('zeros duration bonus when lesson under 15 minutes', () => {
      const r = service.computeMentorDaily({
        studentsTaught: 20,
        durationMinutes: 14,
        scoresGiven: 20,
        redNotified: 0,
      });
      // students 5 + duration 0 + scores 5 + red 0
      expect(r.totalScore).toBe(10);
    });

    it('scales students linearly when below the 20-target', () => {
      const r = service.computeMentorDaily({
        studentsTaught: 4, // 4/20 × 5 = 1
        durationMinutes: 60,
        scoresGiven: 4, // 4/20 × 5 = 1
        redNotified: 0,
      });
      // students 1 + duration 5 + scores 1 + red 0
      expect(r.totalScore).toBe(7);
    });

    it('red notification is binary, not per-warning', () => {
      const five = service.computeMentorDaily({
        studentsTaught: 0,
        durationMinutes: 0,
        scoresGiven: 0,
        redNotified: 5, // five warnings still = +5, not +25
      });
      expect(five.totalScore).toBe(5);
    });
  });
});
