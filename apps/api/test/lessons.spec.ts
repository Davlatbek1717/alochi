import { LessonsService } from '../src/lessons/lessons.service';
import { translateError } from '../src/i18n/errors';

const mockI18n = { t: (key: string) => translateError(key as any) };
const mockCache = {
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

describe('LessonsService', () => {
  const mockPrisma = {
    lesson: {
      create: jest.fn().mockResolvedValue({
        id: 'lesson-uuid',
        tenantId: 'tenant-uuid',
        title: 'Present Simple',
        orderNumber: 1,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  beforeEach(() => jest.clearAllMocks());

  const service = new LessonsService(
    mockPrisma as any,
    mockI18n as any,
    mockCache as any,
  );

  it('creates a lesson', async () => {
    const result = await service.create(
      {
        title: 'Present Simple',
        type: 'english' as any,
        orderNumber: 1,
        youtubeUrl: 'https://youtu.be/test',
        nRepetitions: 3,
      },
      'tenant-uuid',
    );
    expect(result.id).toBe('lesson-uuid');
    expect(mockPrisma.lesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Present Simple' }),
      }),
    );
  });

  it('blocks duplicate order number in same tenant', async () => {
    mockPrisma.lesson.findFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.create(
        {
          title: 'Another',
          type: 'english' as any,
          orderNumber: 1,
          youtubeUrl: 'https://youtu.be/test2',
          nRepetitions: 3,
        },
        'tenant-uuid',
      ),
    ).rejects.toThrow('tartib raqami');
  });
});
