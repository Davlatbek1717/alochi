import { ChurnService } from '../src/churn/churn.service';

describe('ChurnService', () => {
  const mockPrisma = {
    churnScore: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findMany: jest.fn(),
    },
    attendanceStudent: {
      count: jest.fn(),
    },
    studentXp: {
      findUnique: jest.fn(),
    },
    studentProgress: {
      count: jest.fn(),
    },
    studentStatus: {
      findFirst: jest.fn(),
    },
  };

  const mockNotifications = { send: jest.fn().mockResolvedValue({}) };
  const mockHttp = { post: jest.fn(), get: jest.fn() };
  const mockConfig = { get: jest.fn() };
  const service = new ChurnService(
    mockPrisma as any,
    mockNotifications as any,
    mockHttp as any,
    mockConfig as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('computeScoreRuleBased returns 30 for absent3Days only', () => {
    expect(
      service.computeScoreRuleBased({
        absent3Days: true,
        streakBroken: false,
        passRateDrop: false,
        redStatus: false,
        noParentTg: false,
      }),
    ).toBe(30);
  });

  it('computeScoreRuleBased returns 75 for absent + streakBroken + redStatus', () => {
    expect(
      service.computeScoreRuleBased({
        absent3Days: true,
        streakBroken: true,
        passRateDrop: false,
        redStatus: true,
        noParentTg: false,
      }),
    ).toBe(75);
  });

  it('computeScoreRuleBased caps at 100 when all signals active', () => {
    expect(
      service.computeScoreRuleBased({
        absent3Days: true,
        streakBroken: true,
        passRateDrop: true,
        redStatus: true,
        noParentTg: true,
      }),
    ).toBe(100); // raw=110
  });

  it('computeScoreRuleBased returns 0 when no signals', () => {
    expect(
      service.computeScoreRuleBased({
        absent3Days: false,
        streakBroken: false,
        passRateDrop: false,
        redStatus: false,
        noParentTg: false,
      }),
    ).toBe(0);
  });
});
