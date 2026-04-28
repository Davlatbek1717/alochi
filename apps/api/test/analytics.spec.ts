import { AnalyticsService } from '../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  const mockPrisma = {
    $queryRawUnsafe: jest.fn(),
    analyticsEvent: {
      groupBy: jest.fn(),
    },
  };

  const service = new AnalyticsService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('getLessonStats returns rows from materialized view', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { lesson_id: 'l-1', pass_rate: 75.0, total_students: 10, passed: 7, avg_sessions: 3.2, feedback_avg: 2.5 },
    ]);

    const result = await service.getLessonStats('tenant-1');

    expect(result).toHaveLength(1);
    expect(result[0].passRate).toBe(75);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('lesson_stats_mv'),
      'tenant-1',
    );
  });

  it('getBranchStats returns rows from materialized view', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { branch_id: 'b-1', active_students: 20, avg_streak: 5.5, avg_xp: 1200 },
    ]);

    const result = await service.getBranchStats('tenant-1');

    expect(result).toHaveLength(1);
    expect(result[0].avgStreak).toBe(5.5);
  });

  it('getStudentActivity returns daily counts for period', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { day: '2026-04-01', count: '15' },
      { day: '2026-04-02', count: '18' },
    ]);

    const result = await service.getStudentActivity('tenant-1', 'weekly');
    expect(result).toHaveLength(2);
  });
});
