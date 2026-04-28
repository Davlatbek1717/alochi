import { ProgressService } from '../src/lesson-progress/progress.service';

describe('ProgressService', () => {
  const mockPrisma = {
    studentProgress: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    lesson: {
      findFirst: jest.fn(),
    },
    studentLessonConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  beforeEach(() => jest.clearAllMocks());

  const mockFeedEvent = { emit: jest.fn().mockResolvedValue({}) };
  const mockAnalytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new ProgressService(mockPrisma as any, mockFeedEvent as any, mockAnalytics as any);

  it('increments session count and marks homeCompleted when reaching N', async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'l1', nRepetitions: 3, maxNOverride: 10 });
    mockPrisma.studentLessonConfig.findUnique.mockResolvedValue(null);
    mockPrisma.studentProgress.findUnique.mockResolvedValue({ sessionCount: 2, homeCompleted: false });
    mockPrisma.studentProgress.upsert.mockResolvedValue({ sessionCount: 3, homeCompleted: true });

    const result = await service.completeSession('s-id', 'l-id', 't-id');
    expect(result.homeCompleted).toBe(true);
  });

  it('uses manager N override when set', async () => {
    mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'l1', nRepetitions: 3, maxNOverride: 10 });
    mockPrisma.studentLessonConfig.findUnique.mockResolvedValue({ nRepetitionsOverride: 2 });
    mockPrisma.studentProgress.findUnique.mockResolvedValue({ sessionCount: 1, homeCompleted: false });
    mockPrisma.studentProgress.upsert.mockResolvedValue({ sessionCount: 2, homeCompleted: true });

    const result = await service.completeSession('s-id', 'l-id', 't-id');
    expect(result.homeCompleted).toBe(true);
  });
});
