import { AnalyticsService } from '../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  const mockPrisma = {
    $queryRawUnsafe: jest.fn(),
    analyticsEvent: {
      create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
      update: jest.fn(),
    },
  };

  const mockClickHouseDefault = {
    isReady: jest.fn().mockReturnValue(false),
    insertEvent: jest.fn(),
    query: jest.fn(),
  };

  const service = new AnalyticsService(
    mockPrisma as never,
    mockClickHouseDefault as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('getLessonStats returns rows from materialized view', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        lesson_id: 'l-1',
        pass_rate: 75.0,
        total_students: 10,
        passed: 7,
        avg_sessions: 3.2,
        feedback_avg: 2.5,
      },
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

  it('logEvent creates analytics event record', async () => {
    mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'ev-1' });
    await service.logEvent({
      tenantId: 'tenant-1',
      eventType: 'lesson_completed',
      studentId: 'student-1',
      data: { lessonId: 'l-1' },
    });
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          eventType: 'lesson_completed',
        }),
      }),
    );
  });

  // ============================================================
  // Phase 2: Dual-write tests
  // ============================================================
  describe('logEvent (dual-write)', () => {
    it('writes to PostgreSQL and ClickHouse, marks syncedAt on success', async () => {
      const createdEvent = {
        id: 'evt-1',
        tenantId: 't1',
        eventType: 'lesson_completed',
        studentId: 's1',
        branchId: null,
        data: { lessonId: 'l1', sessionCount: 3 },
        createdAt: new Date('2026-04-30T10:00:00Z'),
      };
      mockPrisma.analyticsEvent.create.mockResolvedValue(createdEvent);
      mockPrisma.analyticsEvent.update.mockResolvedValue({});
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn().mockResolvedValue(undefined),
        query: jest.fn(),
      };

      const service = new AnalyticsService(
        mockPrisma as never,
        mockClickHouse as never,
      );
      await service.logEvent({
        tenantId: 't1',
        eventType: 'lesson_completed',
        studentId: 's1',
        data: { lessonId: 'l1', sessionCount: 3 },
      });

      // Allow microtasks to resolve (CH insert + syncedAt update)
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalled();
      expect(mockClickHouse.insertEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'evt-1',
          event_type: 'lesson_completed',
          tenant_id: 't1',
          lesson_id: 'l1',
          session_count: 3,
        }),
      );
      expect(mockPrisma.analyticsEvent.update).toHaveBeenCalledWith({
        where: { id: 'evt-1' },
        data: { syncedAt: expect.any(Date) },
      });
    });

    it('skips ClickHouse when not ready (still writes to PG)', async () => {
      mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'evt-2' });
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(false),
        insertEvent: jest.fn(),
        query: jest.fn(),
      };

      const service = new AnalyticsService(
        mockPrisma as never,
        mockClickHouse as never,
      );
      await service.logEvent({ tenantId: 't1', eventType: 'lesson_completed' });

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalled();
      expect(mockClickHouse.insertEvent).not.toHaveBeenCalled();
      expect(mockPrisma.analyticsEvent.update).not.toHaveBeenCalled();
    });

    it('does NOT throw when ClickHouse insert fails (PG write succeeds, syncedAt stays null)', async () => {
      mockPrisma.analyticsEvent.create.mockResolvedValue({
        id: 'evt-3',
        tenantId: 't1',
        eventType: 'lesson_completed',
        studentId: null,
        branchId: null,
        createdAt: new Date(),
      });
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn().mockRejectedValue(new Error('CH down')),
        query: jest.fn(),
      };

      const service = new AnalyticsService(
        mockPrisma as never,
        mockClickHouse as never,
      );
      await expect(
        service.logEvent({ tenantId: 't1', eventType: 'lesson_completed' }),
      ).resolves.not.toThrow();

      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalled();
      expect(mockClickHouse.insertEvent).toHaveBeenCalled();
      expect(mockPrisma.analyticsEvent.update).not.toHaveBeenCalled();
    });

    it('throws when PostgreSQL write fails (no silent loss)', async () => {
      mockPrisma.analyticsEvent.create.mockRejectedValue(new Error('PG down'));
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn(),
        query: jest.fn(),
      };

      const service = new AnalyticsService(
        mockPrisma as never,
        mockClickHouse as never,
      );
      await expect(
        service.logEvent({ tenantId: 't1', eventType: 'lesson_completed' }),
      ).rejects.toThrow('PG down');

      expect(mockClickHouse.insertEvent).not.toHaveBeenCalled();
    });

    it('getStudentActivity queries ClickHouse with tenant filter', async () => {
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn(),
        query: jest.fn().mockResolvedValue([
          { day: '2026-04-29', count: '12' },
          { day: '2026-04-30', count: '15' },
        ]),
      };

      const service = new AnalyticsService(
        mockPrisma as never,
        mockClickHouse as never,
      );
      const result = await service.getStudentActivity('t1', 'weekly');

      expect(mockClickHouse.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = {tenantId:UUID}'),
        { tenantId: 't1' },
      );
      expect(result).toEqual([
        { day: '2026-04-29', count: 12 },
        { day: '2026-04-30', count: 15 },
      ]);
    });
  });
});
