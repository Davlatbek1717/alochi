import { StudentConfigService } from '../src/student-lesson-config/config.service';

describe('StudentConfigService (N Override)', () => {
  const mockPrisma = {
    lesson: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'l1', nRepetitions: 3, maxNOverride: 10 }),
    },
    studentLessonConfig: {
      upsert: jest.fn().mockResolvedValue({ nRepetitionsOverride: 5 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(() => jest.clearAllMocks());

  const service = new StudentConfigService(mockPrisma as any);

  it('allows manager to set N override within limits', async () => {
    const result = await service.setNOverride({
      studentId: 's-id',
      lessonId: 'l-id',
      tenantId: 't-id',
      managerId: 'm-id',
      nRepetitions: 5,
    });
    expect(result.nRepetitionsOverride).toBe(5);
  });

  it('blocks N override above maxNOverride', async () => {
    await expect(
      service.setNOverride({
        studentId: 's-id',
        lessonId: 'l-id',
        tenantId: 't-id',
        managerId: 'm-id',
        nRepetitions: 15,
      }),
    ).rejects.toThrow('maximal');
  });

  it('blocks N override below 1', async () => {
    await expect(
      service.setNOverride({
        studentId: 's-id',
        lessonId: 'l-id',
        tenantId: 't-id',
        managerId: 'm-id',
        nRepetitions: 0,
      }),
    ).rejects.toThrow('kamida');
  });
});
