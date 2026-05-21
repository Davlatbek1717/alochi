import { Test } from '@nestjs/testing';
import { StreakService } from './streak.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

const mockPrisma = {
  studentStreak: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ tenantId: 't1' }),
  },
};

const mockAnalytics = { logEvent: jest.fn().mockResolvedValue(undefined) };

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe('StreakService', () => {
  let service: StreakService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AnalyticsService, useValue: mockAnalytics },
      ],
    }).compile();
    service = module.get(StreakService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('recordActivity', () => {
    it('creates a streak of 1 when student has no existing record', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue(null);
      mockPrisma.studentStreak.upsert.mockResolvedValue({
        studentId: 's1',
        currentStreak: 1,
      });

      const result = await service.recordActivity('s1');

      expect(mockPrisma.studentStreak.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ currentStreak: 1 }),
        }),
      );
      expect(result!.currentStreak).toBe(1);
    });

    it('increments streak by 1 when last activity was yesterday', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue({
        studentId: 's1',
        currentStreak: 5,
        longestStreak: 5,
        shieldCount: 0,
        lastActivity: daysAgo(1),
      });
      mockPrisma.studentStreak.update.mockResolvedValue({
        studentId: 's1',
        currentStreak: 6,
      });

      const result = await service.recordActivity('s1');

      const updateData = mockPrisma.studentStreak.update.mock.calls[0][0].data;
      expect(updateData.currentStreak).toBe(6);
      expect(result!.currentStreak).toBe(6);
    });

    it('resets streak to 1 when gap is more than 1 day and no shield', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue({
        studentId: 's1',
        currentStreak: 10,
        longestStreak: 10,
        shieldCount: 0,
        lastActivity: daysAgo(3),
      });
      mockPrisma.studentStreak.update.mockResolvedValue({
        studentId: 's1',
        currentStreak: 1,
      });

      await service.recordActivity('s1');

      const updateData = mockPrisma.studentStreak.update.mock.calls[0][0].data;
      expect(updateData.currentStreak).toBe(1);
    });

    it('uses shield and keeps streak when gap is exactly 2 days and shieldCount > 0', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue({
        studentId: 's1',
        currentStreak: 8,
        longestStreak: 8,
        shieldCount: 2,
        lastActivity: daysAgo(2),
      });
      mockPrisma.studentStreak.update.mockResolvedValue({
        studentId: 's1',
        currentStreak: 9,
        shieldCount: 1,
      });

      await service.recordActivity('s1');

      const updateData = mockPrisma.studentStreak.update.mock.calls[0][0].data;
      expect(updateData.currentStreak).toBe(9);
      expect(updateData.shieldCount).toBe(1);
    });

    it('returns existing record unchanged when activity is recorded on the same day', async () => {
      const streak = {
        studentId: 's1',
        currentStreak: 4,
        longestStreak: 4,
        shieldCount: 0,
        lastActivity: new Date(),
      };
      mockPrisma.studentStreak.findUnique.mockResolvedValue(streak);

      const result = await service.recordActivity('s1');

      expect(mockPrisma.studentStreak.update).not.toHaveBeenCalled();
      expect(mockPrisma.studentStreak.upsert).not.toHaveBeenCalled();
      expect(result).toBe(streak);
    });

    it('awards a shield when streak reaches a multiple of 7', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue({
        studentId: 's1',
        currentStreak: 6,
        longestStreak: 6,
        shieldCount: 0,
        lastActivity: daysAgo(1),
      });
      mockPrisma.studentStreak.update.mockResolvedValue({
        studentId: 's1',
        currentStreak: 7,
        shieldCount: 1,
      });

      await service.recordActivity('s1');

      const updateData = mockPrisma.studentStreak.update.mock.calls[0][0].data;
      expect(updateData.currentStreak).toBe(7);
      expect(updateData.shieldCount).toBe(1);
    });
  });

  describe('getStudentStreak', () => {
    it('returns streak 0 and hasShield false when no streak record exists', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue(null);

      const result = await service.getStudentStreak('s1');

      expect(result).toEqual({ streak: 0, hasShield: false });
    });

    it('returns current streak and hasShield false when shieldCount is 0', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue({
        studentId: 's1',
        currentStreak: 5,
        longestStreak: 5,
        shieldCount: 0,
        lastActivity: daysAgo(1),
      });

      const result = await service.getStudentStreak('s1');

      expect(result).toEqual({ streak: 5, hasShield: false });
    });

    it('returns current streak and hasShield true when shieldCount is greater than 0', async () => {
      mockPrisma.studentStreak.findUnique.mockResolvedValue({
        studentId: 's1',
        currentStreak: 3,
        longestStreak: 7,
        shieldCount: 2,
        lastActivity: daysAgo(1),
      });

      const result = await service.getStudentStreak('s1');

      expect(result).toEqual({ streak: 3, hasShield: true });
    });
  });
});
