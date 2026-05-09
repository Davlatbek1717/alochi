import { DuelService } from '../src/social/duel.service';

describe('DuelService', () => {
  const mockPrisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ name: 'Test User', tenantId: 'tenant-1' }),
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

  const mockFeedEvent = { emit: jest.fn().mockResolvedValue({}) };

  const mockGateway = {
    sendDuelUpdate: jest.fn(),
    emitDuelChallenge: jest.fn(),
  };
  const service = new DuelService(
    mockPrisma as any,
    mockFeedEvent as any,
    mockGateway as any,
  );

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

  it('persists answerMs on duelAnswer.create', async () => {
    const localPrisma = {
      ...mockPrisma,
      duel: {
        ...mockPrisma.duel,
        findUnique: jest.fn().mockResolvedValue({
          id: 'duel-x',
          status: 'active',
          expiresAt: new Date(Date.now() + 3_600_000),
          challengerId: 'challenger',
          challengedId: 'challenged',
          questions: [{ correct: 0 }],
          challengerScore: 0,
          challengedScore: 0,
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      duelAnswer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const svc = new DuelService(
      localPrisma as never,
      mockFeedEvent as never,
      mockGateway as never,
    );
    await svc.submitAnswer('duel-x', 'challenger', 0, 0, 1234);
    expect(localPrisma.duelAnswer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ answerMs: 1234 }),
      }),
    );
  });

  it('expireOverdue expires pending no-show duels without XP', async () => {
    const localPrisma = {
      duel: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([]) // active expired
          .mockResolvedValueOnce([
            { id: 'd-1', challengerId: 'c-1' },
            { id: 'd-2', challengerId: 'c-2' },
          ]), // pending no-show
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      duelAnswer: { count: jest.fn().mockResolvedValue(0) },
    };
    const svc = new DuelService(
      localPrisma as never,
      mockFeedEvent as never,
      mockGateway as never,
    );
    await svc.expireOverdue();
    // Just verifies status was flipped — no XP assertion
    expect(localPrisma.duel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'expired' },
      }),
    );
  });
});
