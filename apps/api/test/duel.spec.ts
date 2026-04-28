import { DuelService } from '../src/social/duel.service';

describe('DuelService', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Test User', tenantId: 'tenant-1' }),
    },
    studentProgress: {
      findMany: jest.fn(),
    },
    lessonComponent: {
      findMany: jest.fn().mockResolvedValue([
        {
          config: {
            questions: [
              { text: 'Q1', options: ['A', 'B', 'C', 'D'], correct: 0 },
              { text: 'Q2', options: ['A', 'B', 'C', 'D'], correct: 1 },
              { text: 'Q3', options: ['A', 'B', 'C', 'D'], correct: 2 },
              { text: 'Q4', options: ['A', 'B', 'C', 'D'], correct: 0 },
              { text: 'Q5', options: ['A', 'B', 'C', 'D'], correct: 1 },
              { text: 'Q6', options: ['A', 'B', 'C', 'D'], correct: 2 },
              { text: 'Q7', options: ['A', 'B', 'C', 'D'], correct: 0 },
              { text: 'Q8', options: ['A', 'B', 'C', 'D'], correct: 1 },
              { text: 'Q9', options: ['A', 'B', 'C', 'D'], correct: 2 },
              { text: 'Q10', options: ['A', 'B', 'C', 'D'], correct: 0 },
            ],
          },
        },
      ]),
    },
    duel: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'duel-1', questions: [] }),
      findUnique: jest.fn(),
    },
    duelAnswer: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const mockXp = { award: jest.fn().mockResolvedValue({}) };
  const mockFeedEvent = { emit: jest.fn().mockResolvedValue({}) };

  const mockGateway = { sendDuelUpdate: jest.fn(), emitDuelChallenge: jest.fn() };
  const service = new DuelService(mockPrisma as any, mockXp as any, mockFeedEvent as any, mockGateway as any);

  it('selects questions from shared completed lessons', async () => {
    mockPrisma.studentProgress.findMany
      .mockResolvedValueOnce([{ lessonId: 'l-1' }, { lessonId: 'l-2' }])
      .mockResolvedValueOnce([{ lessonId: 'l-1' }, { lessonId: 'l-3' }]);

    await service.create('challenger', 'challenged', 'tenant-id');
    expect(mockPrisma.lessonComponent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lessonId: { in: expect.arrayContaining(['l-1']) },
        }),
      }),
    );
  });

  it('requires at least 1 shared lesson', async () => {
    mockPrisma.studentProgress.findMany
      .mockResolvedValueOnce([{ lessonId: 'l-1' }])
      .mockResolvedValueOnce([{ lessonId: 'l-99' }]);

    await expect(
      service.create('challenger', 'challenged', 'tenant-id'),
    ).rejects.toThrow('Umumiy');
  });
});
