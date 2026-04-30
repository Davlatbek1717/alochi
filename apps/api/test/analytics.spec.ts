import { AnalyticsService } from '../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  const mockPrisma = {
    $queryRawUnsafe: jest.fn(),
    analyticsEvent: {
      create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
      update: jest.fn(),
    },
    tenant: { findMany: jest.fn() },
    lesson: { findMany: jest.fn().mockResolvedValue([]) },
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

  // ============================================================
  // Phase 4: New OLAP query tests
  // ============================================================
  describe('OLAP queries', () => {
    function makeService(chRows: unknown[] = []) {
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn(),
        query: jest.fn().mockResolvedValue(chRows),
      };
      const service = new AnalyticsService(
        mockPrisma as never,
        mockClickHouse as never,
      );
      return { service, mockClickHouse };
    }

    it('getCohortRetention queries ClickHouse with tenantId and weeks param', async () => {
      const { service, mockClickHouse } = makeService([
        {
          cohort_week: '2026-04-20',
          week_offset: '0',
          cohort_size: '10',
          active: '10',
        },
        {
          cohort_week: '2026-04-20',
          week_offset: '1',
          cohort_size: '10',
          active: '8',
        },
      ]);
      const result = await service.getCohortRetention('t1', 8);

      expect(mockClickHouse.query).toHaveBeenCalledWith(
        expect.stringContaining('cohort'),
        expect.objectContaining({ tenantId: 't1', weeks: 8 }),
      );
      expect(result).toEqual([
        {
          cohortWeek: '2026-04-20',
          size: 10,
          retention: { week0: 100, week1: 80 },
        },
      ]);
    });

    it('getFunnel returns ordered steps with drop-off', async () => {
      const { service } = makeService([
        { event_type: 'lesson_session', cnt: '100' },
        { event_type: 'lesson_failed', cnt: '20' },
        { event_type: 'lesson_completed', cnt: '70' },
      ]);
      const result = await service.getFunnel('t1', 'l1');
      expect(result).toEqual([
        { step: 'Sessiya boshlangan', count: 100 },
        { step: 'Test topshirgan', count: 80 },
        { step: 'Muvaffaqiyatli yakunlangan', count: 70 },
      ]);
    });

    it('getLifecycle returns DAU/WAU/MAU/stickiness', async () => {
      const { service } = makeService([{ dau: '20', wau: '60', mau: '120' }]);
      const result = await service.getLifecycle('t1');
      expect(result).toEqual({ dau: 20, wau: 60, mau: 120, stickiness: 0.17 });
    });

    it('getTopFailures returns sorted lessons with failure rate', async () => {
      const { service } = makeService([
        { lesson_id: 'l1', failed: '50', completed: '50' },
        { lesson_id: 'l2', failed: '30', completed: '70' },
      ]);
      mockPrisma.lesson.findMany.mockResolvedValue([
        { id: 'l1', title: 'Lesson One' },
        { id: 'l2', title: 'Lesson Two' },
      ]);
      const result = await service.getTopFailures('t1', 10);
      expect(result).toEqual([
        {
          lessonId: 'l1',
          lessonTitle: 'Lesson One',
          failedCount: 50,
          completedCount: 50,
          failureRate: 50,
        },
        {
          lessonId: 'l2',
          lessonTitle: 'Lesson Two',
          failedCount: 30,
          completedCount: 70,
          failureRate: 30,
        },
      ]);
    });

    it('getTenantComparison joins PG tenants with CH stats', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 't1', name: 'Markaz Bir' },
        { id: 't2', name: 'Markaz Ikki' },
      ]);
      const { service } = makeService([
        { tenant_id: 't1', dau: '15', events_30d: '500' },
      ]);
      const result = await service.getTenantComparison();
      expect(result).toEqual([
        {
          tenantId: 't1',
          tenantName: 'Markaz Bir',
          dau: 15,
          eventsLast30d: 500,
        },
        { tenantId: 't2', tenantName: 'Markaz Ikki', dau: 0, eventsLast30d: 0 },
      ]);
    });
  });
});
