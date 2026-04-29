import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';
import { AnalyticsService } from '../analytics/analytics.service';

const mockAnalytics = { logEvent: jest.fn().mockResolvedValue(undefined) };

const mockPrisma = {
  lesson: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  studentLessonConfig: {
    findUnique: jest.fn(),
  },
  studentProgress: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockFeedEvent = {
  emit: jest.fn().mockResolvedValue(undefined),
};

describe('ProgressService', () => {
  let service: ProgressService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FeedEventService, useValue: mockFeedEvent },
        { provide: AnalyticsService, useValue: mockAnalytics },
      ],
    }).compile();
    service = module.get(ProgressService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('completeSession', () => {
    it('marks homeCompleted when session count reaches nRepetitions', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'l1', nRepetitions: 3, maxNOverride: 10 });
      mockPrisma.studentLessonConfig.findUnique.mockResolvedValue(null);
      mockPrisma.studentProgress.findUnique.mockResolvedValue({ sessionCount: 2, homeCompleted: false });
      mockPrisma.studentProgress.upsert.mockResolvedValue({ sessionCount: 3, homeCompleted: true });

      const result = await service.completeSession('s-1', 'l-1', 't-1');

      expect(result.homeCompleted).toBe(true);
    });

    it('uses N override when student has a custom config', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'l1', nRepetitions: 5, maxNOverride: 10 });
      mockPrisma.studentLessonConfig.findUnique.mockResolvedValue({ nRepetitionsOverride: 2 });
      mockPrisma.studentProgress.findUnique.mockResolvedValue({ sessionCount: 1, homeCompleted: false });
      mockPrisma.studentProgress.upsert.mockResolvedValue({ sessionCount: 2, homeCompleted: true });

      const result = await service.completeSession('s-1', 'l-1', 't-1');

      expect(result.homeCompleted).toBe(true);
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);

      await expect(service.completeSession('s-1', 'no-lesson', 't-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAcademyCompleted', () => {
    it('sets academyCompleted to true', async () => {
      mockPrisma.studentProgress.update.mockResolvedValue({ academyCompleted: true });
      mockPrisma.lesson.findUnique.mockResolvedValue({ title: 'Test Lesson', tenantId: 't-1' });

      const result = await service.markAcademyCompleted('s-1', 'l-1');

      expect(mockPrisma.studentProgress.update).toHaveBeenCalledWith({
        where: { studentId_lessonId: { studentId: 's-1', lessonId: 'l-1' } },
        data: expect.objectContaining({ academyCompleted: true }),
      });
      expect(result.academyCompleted).toBe(true);
    });
  });

  describe('getStudentProgress', () => {
    it('returns progress list for a student', async () => {
      const progress = [
        { lessonId: 'l-1', sessionCount: 3, homeCompleted: true },
        { lessonId: 'l-2', sessionCount: 1, homeCompleted: false },
      ];
      mockPrisma.studentProgress.findMany.mockResolvedValue(progress);

      const result = await service.getStudentProgress('s-1');

      expect(mockPrisma.studentProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's-1' } }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
