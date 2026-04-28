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
    const config = { minN: 1, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(3, 5, 10, config)).toBe(4); // errorRate=0.5 > 0.40
  });

  it('computeNewN decreases N when errorRate < easyThreshold', () => {
    const config = { minN: 1, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(3, 1, 10, config)).toBe(2); // errorRate=0.1 < 0.15
  });

  it('computeNewN keeps N when errorRate is in middle range', () => {
    const config = { minN: 1, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(3, 3, 10, config)).toBe(3); // errorRate=0.3
  });

  it('computeNewN does not exceed maxN', () => {
    const config = { minN: 1, maxN: 5, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(5, 8, 10, config)).toBe(5); // already at max
  });

  it('computeNewN does not go below minN', () => {
    const config = { minN: 2, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(2, 1, 10, config)).toBe(2); // already at min
  });

  it('computeNewN returns currentN when totalQuestions is 0', () => {
    const config = { minN: 1, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(3, 0, 0, config)).toBe(3);
  });
});
