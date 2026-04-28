import { StreakService } from '../src/gamification/streak.service';

describe('StreakService', () => {
  const mockPrisma = {
    studentXp: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    },
  };
  const mockAnalytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new StreakService(mockPrisma as any, mockAnalytics as any);

  it('increments streak on consecutive day', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    mockPrisma.studentXp.findUnique.mockResolvedValue({
      currentStreak: 5,
      longestStreak: 5,
      shieldCount: 0,
      lastActivity: yesterday,
    });

    await service.recordActivity('student-id');
    expect(mockPrisma.studentXp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStreak: 6 }),
      }),
    );
  });

  it('uses shield when 1 day missed', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    mockPrisma.studentXp.findUnique.mockResolvedValue({
      currentStreak: 10,
      longestStreak: 10,
      shieldCount: 1,
      lastActivity: twoDaysAgo,
    });

    await service.recordActivity('student-id');
    expect(mockPrisma.studentXp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStreak: 11,
          shieldCount: 0,
        }),
      }),
    );
  });

  it('resets streak when 2+ days missed (no shield)', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    mockPrisma.studentXp.findUnique.mockResolvedValue({
      currentStreak: 7,
      longestStreak: 7,
      shieldCount: 0,
      lastActivity: threeDaysAgo,
    });

    await service.recordActivity('student-id');
    expect(mockPrisma.studentXp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStreak: 1 }),
      }),
    );
  });
});
