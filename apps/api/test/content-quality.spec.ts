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
});
