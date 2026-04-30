import { ContentQualityService } from '../src/content-quality/content-quality.service';

describe('ContentQualityService', () => {
  const mockPrisma = {
    lesson: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'lesson-1', tenantId: 'tenant-1' }),
    },
    studentProgress: {
      count: jest.fn().mockResolvedValue(0),
    },
    lessonFeedback: {
      upsert: jest.fn().mockResolvedValue({ id: 'fb-1', rating: 3 }),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _avg: { rating: null }, _count: 0 }),
    },
    lessonVariant: {
      create: jest.fn().mockResolvedValue({ id: 'v-1', variant: 'B' }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    studentVariantAssignment: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ variantId: 'v-1' }),
    },
  };

  const service = new ContentQualityService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('submitFeedback upserts feedback with correct rating', async () => {
    await service.submitFeedback('student-1', 'lesson-1', 3);
    expect(mockPrisma.lessonFeedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_lessonId: { studentId: 'student-1', lessonId: 'lesson-1' },
        },
        create: expect.objectContaining({ rating: 3 }),
        update: expect.objectContaining({ rating: 3 }),
      }),
    );
  });

  it('getVariantForStudent returns existing assignment', async () => {
    mockPrisma.studentVariantAssignment.findUnique.mockResolvedValue({
      variantId: 'v-A',
    });
    const result = await service.getVariantForStudent('s-1', 'l-1');
    expect(result).toEqual({ variantId: 'v-A' });
    expect(mockPrisma.studentVariantAssignment.create).not.toHaveBeenCalled();
  });

  it('getVariantForStudent creates random assignment when none exists', async () => {
    mockPrisma.studentVariantAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.lessonVariant.findMany.mockResolvedValue([
      { id: 'v-A', variant: 'A' },
      { id: 'v-B', variant: 'B' },
    ]);
    await service.getVariantForStudent('s-1', 'l-1');
    expect(mockPrisma.studentVariantAssignment.create).toHaveBeenCalledTimes(1);
  });

  it('promoteVariant deactivates the losing variant', async () => {
    await service.promoteVariant('lesson-1', 'A', 'tenant-1');
    expect(mockPrisma.lessonVariant.updateMany).toHaveBeenCalledWith({
      where: { lessonId: 'lesson-1', variant: { not: 'A' } },
      data: { isActive: false },
    });
  });

  // ============================================================
  // Phase 13.3: passRate calc, A/B distribution, promote winner
  // ============================================================

  it('getLessonStats computes passRate from progress counts (7/10 → 70%)', async () => {
    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: 'lesson-1', title: 'Lesson 1' },
    ]);
    // Order: total then passed (Promise.all index 0 and 1)
    mockPrisma.studentProgress.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(7); // passed
    mockPrisma.lessonFeedback.aggregate.mockResolvedValue({
      _avg: { rating: 2.4 },
      _count: 5,
    });

    const result = await service.getLessonStats('tenant-1');

    expect(result).toEqual([
      {
        lessonId: 'lesson-1',
        title: 'Lesson 1',
        passRate: 70,
        totalStudents: 10,
        feedbackAvg: 2.4,
        feedbackCount: 5,
      },
    ]);
  });

  it('getLessonStats returns 0 passRate when total students is 0', async () => {
    mockPrisma.lesson.findMany.mockResolvedValue([
      { id: 'lesson-2', title: 'Empty' },
    ]);
    mockPrisma.studentProgress.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.lessonFeedback.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: 0,
    });

    const result = await service.getLessonStats('tenant-1');
    expect(result[0].passRate).toBe(0);
    expect(result[0].feedbackAvg).toBe(null);
  });

  it('submitFeedback rejects ratings outside 1..3 (BadRequestException)', async () => {
    await expect(service.submitFeedback('s-1', 'l-1', 5)).rejects.toThrow();
    await expect(service.submitFeedback('s-1', 'l-1', 0)).rejects.toThrow();
    expect(mockPrisma.lessonFeedback.upsert).not.toHaveBeenCalled();
  });

  it('getVariantForStudent picks variants in roughly 50/50 distribution', async () => {
    mockPrisma.studentVariantAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.lessonVariant.findMany.mockResolvedValue([
      { id: 'v-A', variant: 'A' },
      { id: 'v-B', variant: 'B' },
    ]);

    const counts: Record<string, number> = { 'v-A': 0, 'v-B': 0 };
    mockPrisma.studentVariantAssignment.create.mockImplementation(
      ({ data }: { data: { variantId: string } }) => {
        counts[data.variantId] = (counts[data.variantId] ?? 0) + 1;
        return Promise.resolve({ ...data });
      },
    );

    // Call 100 times — Math.random has natural variance, so check loose bounds
    for (let i = 0; i < 100; i++) {
      await service.getVariantForStudent(`student-${i}`, 'lesson-1');
    }

    // 50/50 with 100 samples → expect both arms in [40, 60] for low flake risk.
    // Using [30, 70] for extra safety against rare seed-dependent runs.
    expect(counts['v-A']).toBeGreaterThanOrEqual(30);
    expect(counts['v-A']).toBeLessThanOrEqual(70);
    expect(counts['v-B']).toBeGreaterThanOrEqual(30);
    expect(counts['v-B']).toBeLessThanOrEqual(70);
    expect(counts['v-A'] + counts['v-B']).toBe(100);
  });

  it('promoteVariant deactivates the OPPOSITE variant (winner stays active)', async () => {
    await service.promoteVariant('lesson-1', 'B', 'tenant-1');
    expect(mockPrisma.lessonVariant.updateMany).toHaveBeenCalledWith({
      where: { lessonId: 'lesson-1', variant: { not: 'B' } },
      data: { isActive: false },
    });
  });

  it('promoteVariant rejects when lesson does not belong to tenant', async () => {
    mockPrisma.lesson.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.promoteVariant('lesson-999', 'A', 'tenant-1'),
    ).rejects.toThrow('Dars topilmadi');
    expect(mockPrisma.lessonVariant.updateMany).not.toHaveBeenCalled();
  });
});
