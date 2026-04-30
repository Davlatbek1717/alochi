import { AdaptiveService } from '../src/adaptive/adaptive.service';

describe('AdaptiveService', () => {
  const mockPrisma = {
    adaptiveDifficultyConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    lesson: {
      findMany: jest.fn(),
    },
    lessonComponent: {
      findMany: jest.fn(),
    },
    errorLog: {
      aggregate: jest.fn(),
    },
    studentLessonConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    adaptiveDifficultyLog: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const service = new AdaptiveService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('computeNewN increases N when errorRate > hardThreshold', () => {
    const config = {
      minN: 1,
      maxN: 10,
      hardThreshold: 0.4,
      easyThreshold: 0.15,
    };
    expect(service.computeNewN(3, 5, 10, config)).toBe(4); // errorRate=0.5 > 0.40
  });

  it('computeNewN decreases N when errorRate < easyThreshold', () => {
    const config = {
      minN: 1,
      maxN: 10,
      hardThreshold: 0.4,
      easyThreshold: 0.15,
    };
    expect(service.computeNewN(3, 1, 10, config)).toBe(2); // errorRate=0.1 < 0.15
  });

  it('computeNewN keeps N when errorRate is in middle range', () => {
    const config = {
      minN: 1,
      maxN: 10,
      hardThreshold: 0.4,
      easyThreshold: 0.15,
    };
    expect(service.computeNewN(3, 3, 10, config)).toBe(3); // errorRate=0.3
  });

  it('computeNewN does not exceed maxN', () => {
    const config = {
      minN: 1,
      maxN: 5,
      hardThreshold: 0.4,
      easyThreshold: 0.15,
    };
    expect(service.computeNewN(5, 8, 10, config)).toBe(5); // already at max
  });

  it('computeNewN does not go below minN', () => {
    const config = {
      minN: 2,
      maxN: 10,
      hardThreshold: 0.4,
      easyThreshold: 0.15,
    };
    expect(service.computeNewN(2, 1, 10, config)).toBe(2); // already at min
  });

  it('computeNewN returns currentN when totalQuestions is 0', () => {
    const config = {
      minN: 1,
      maxN: 10,
      hardThreshold: 0.4,
      easyThreshold: 0.15,
    };
    expect(service.computeNewN(3, 0, 0, config)).toBe(3);
  });

  // ============================================================
  // Phase 13.1: threshold-boundary + prisma-integration coverage
  // ============================================================

  describe('threshold boundary behavior', () => {
    const config = {
      minN: 1,
      maxN: 10,
      hardThreshold: 0.4,
      easyThreshold: 0.15,
    };

    // The implementation uses strict `>` for hard and strict `<` for easy.
    // So an errorRate equal to `hardThreshold` is NOT "hard" → no increment.
    // Likewise an errorRate equal to `easyThreshold` is NOT "easy" → no decrement.
    // This boundary contract is explicitly verified here.
    it('keeps N when errorRate equals hardThreshold exactly (strict >)', () => {
      // 4/10 = 0.4 == hardThreshold (0.4) → unchanged
      expect(service.computeNewN(3, 4, 10, config)).toBe(3);
    });

    it('keeps N when errorRate equals easyThreshold exactly (strict <)', () => {
      // 1.5/10 = 0.15 == easyThreshold (0.15) → unchanged
      // Use 3/20 = 0.15 to avoid float rounding
      expect(service.computeNewN(3, 3, 20, config)).toBe(3);
    });
  });

  describe('runNightlyAdaptation prisma integration', () => {
    it('upserts studentLessonConfig and creates audit log when N changes', async () => {
      jest.clearAllMocks();
      mockPrisma.adaptiveDifficultyConfig.findUnique.mockResolvedValue({
        tenantId: 't1',
        minN: 1,
        maxN: 10,
        hardThreshold: 0.4,
        easyThreshold: 0.15,
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 's1' }]);
      mockPrisma.lesson.findMany.mockResolvedValue([
        { id: 'l1', nRepetitions: 3 },
      ]);
      mockPrisma.lessonComponent.findMany.mockResolvedValue([
        { config: { questions: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}] } },
      ]);
      mockPrisma.errorLog.aggregate.mockResolvedValue({
        _sum: { errorCount: 6 }, // 6/10 = 0.6 > 0.4
      });
      mockPrisma.studentLessonConfig.findUnique.mockResolvedValue(null);
      mockPrisma.studentLessonConfig.upsert.mockResolvedValue({});

      const adjusted = await service.runNightlyAdaptation('t1');

      expect(adjusted).toBe(1);
      expect(mockPrisma.studentLessonConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            studentId: 's1',
            lessonId: 'l1',
            nRepetitionsOverride: 4,
          }),
          update: { nRepetitionsOverride: 4 },
        }),
      );
      expect(mockPrisma.adaptiveDifficultyLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentId: 's1',
          lessonId: 'l1',
          oldN: 3,
          newN: 4,
          errorRate: 0.6,
        }),
      });
    });

    it('skips student-lesson when N would not change (no upsert/log)', async () => {
      jest.clearAllMocks();
      mockPrisma.adaptiveDifficultyConfig.findUnique.mockResolvedValue({
        tenantId: 't1',
        minN: 1,
        maxN: 10,
        hardThreshold: 0.4,
        easyThreshold: 0.15,
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 's1' }]);
      mockPrisma.lesson.findMany.mockResolvedValue([
        { id: 'l1', nRepetitions: 3 },
      ]);
      mockPrisma.lessonComponent.findMany.mockResolvedValue([
        { config: { questions: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}] } },
      ]);
      // 3/10 = 0.3 → middle range → no change
      mockPrisma.errorLog.aggregate.mockResolvedValue({
        _sum: { errorCount: 3 },
      });
      mockPrisma.studentLessonConfig.findUnique.mockResolvedValue(null);

      const adjusted = await service.runNightlyAdaptation('t1');

      expect(adjusted).toBe(0);
      expect(mockPrisma.studentLessonConfig.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.adaptiveDifficultyLog.create).not.toHaveBeenCalled();
    });
  });
});
