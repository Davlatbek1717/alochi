import { Test } from '@nestjs/testing';
import { XpService, XP_AMOUNTS } from './xp.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  xpEvent: {
    create: jest.fn(),
  },
  studentXp: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('XpService', () => {
  let service: XpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [XpService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(XpService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getLevel', () => {
    it('returns Novice for 0 XP', () => {
      expect(service.getLevel(0)).toBe('Novice');
    });

    it('returns Learner at 200 XP', () => {
      expect(service.getLevel(200)).toBe('Learner');
    });

    it('returns Scholar at 2000 XP', () => {
      expect(service.getLevel(2000)).toBe('Scholar');
    });

    it('returns Master at 10000 XP', () => {
      expect(service.getLevel(10000)).toBe('Master');
    });

    it('returns Expert between 5000 and 9999 XP', () => {
      expect(service.getLevel(7500)).toBe('Expert');
    });
  });

  describe('award', () => {
    it('creates an xp event and upserts student xp record', async () => {
      const upserted = { studentId: 'student-1', totalXp: 100 };
      mockPrisma.xpEvent.create.mockResolvedValue({});
      mockPrisma.studentXp.upsert.mockResolvedValue(upserted);

      const result = await service.award('student-1', 'LESSON_COMPLETE');

      expect(mockPrisma.xpEvent.create).toHaveBeenCalledWith({
        data: {
          studentId: 'student-1',
          amount: XP_AMOUNTS.LESSON_COMPLETE,
          reason: 'LESSON_COMPLETE',
          metadata: undefined,
        },
      });
      expect(mockPrisma.studentXp.upsert).toHaveBeenCalledWith({
        where: { studentId: 'student-1' },
        create: { studentId: 'student-1', totalXp: XP_AMOUNTS.LESSON_COMPLETE },
        update: { totalXp: { increment: XP_AMOUNTS.LESSON_COMPLETE } },
      });
      expect(result).toEqual(upserted);
    });

    it('accepts lowercase reason keys', async () => {
      mockPrisma.xpEvent.create.mockResolvedValue({});
      mockPrisma.studentXp.upsert.mockResolvedValue({
        studentId: 'student-1',
        totalXp: 50,
      });

      await service.award('student-1', 'perfect_test');

      const eventData = mockPrisma.xpEvent.create.mock.calls[0][0].data;
      expect(eventData.amount).toBe(XP_AMOUNTS.PERFECT_TEST);
      expect(eventData.reason).toBe('PERFECT_TEST');
    });

    it('passes metadata to the xp event when provided', async () => {
      mockPrisma.xpEvent.create.mockResolvedValue({});
      mockPrisma.studentXp.upsert.mockResolvedValue({});
      const meta = { lessonId: 'lesson-42' };

      await service.award('student-1', 'STREAK_DAILY', meta);

      const eventData = mockPrisma.xpEvent.create.mock.calls[0][0].data;
      expect(eventData.metadata).toEqual(meta);
    });
  });

  describe('getStudentXp', () => {
    it('returns default values when student has no xp record', async () => {
      mockPrisma.studentXp.findUnique.mockResolvedValue(null);

      const result = await service.getStudentXp('student-1');

      expect(result).toEqual({ totalXp: 0, level: 'Novice', currentStreak: 0 });
    });

    it('returns xp with computed level and nextLevelXp', async () => {
      mockPrisma.studentXp.findUnique.mockResolvedValue({
        studentId: 'student-1',
        totalXp: 2500,
        currentStreak: 3,
      });

      const result = await service.getStudentXp('student-1');

      expect(result.level).toBe('Scholar');
      expect((result as any).nextLevelXp).toBe(5000);
      expect(result.totalXp).toBe(2500);
    });
  });
});
