import { XpService, XP_AMOUNTS } from '../src/gamification/xp.service';

describe('XpService', () => {
  const mockPrisma = {
    studentXp: {
      upsert: jest.fn().mockResolvedValue({ totalXp: 200, currentStreak: 3 }),
    },
    xpEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new XpService(mockPrisma as any);

  it('awards correct XP for lesson completion', async () => {
    await service.award('student-id', 'lesson_complete');
    expect(mockPrisma.xpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: XP_AMOUNTS.LESSON_COMPLETE }),
      }),
    );
  });

  it('XP_AMOUNTS has all required keys', () => {
    expect(XP_AMOUNTS.LESSON_COMPLETE).toBe(100);
    expect(XP_AMOUNTS.STREAK_DAILY).toBe(20);
    expect(XP_AMOUNTS.PERFECT_TEST).toBe(50);
    expect(XP_AMOUNTS.FAST_SUBMIT).toBe(30);
    expect(XP_AMOUNTS.DAILY_QUEST).toBe(75);
  });

  it('computes level from XP', () => {
    expect(service.getLevel(0)).toBe('Novice');
    expect(service.getLevel(300)).toBe('Learner');
    expect(service.getLevel(1000)).toBe('Learner');
    expect(service.getLevel(2500)).toBe('Scholar');
    expect(service.getLevel(6000)).toBe('Expert');
    expect(service.getLevel(15000)).toBe('Master');
  });
});
