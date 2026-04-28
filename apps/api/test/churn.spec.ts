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
  const service = new ChurnService(mockPrisma as any, mockNotifications as any);

  beforeEach(() => jest.clearAllMocks());

  it('computeScore returns 30 for absent3Days only', () => {
    expect(service.computeScore({ absent3Days: true, streakBroken: false, passRateDrop: false, redStatus: false, noParentTg: false })).toBe(30);
  });

  it('computeScore returns 75 for absent + streakBroken + redStatus', () => {
    expect(service.computeScore({ absent3Days: true, streakBroken: true, passRateDrop: false, redStatus: true, noParentTg: false })).toBe(75);
  });

  it('computeScore caps at 100 when all signals active', () => {
    expect(service.computeScore({ absent3Days: true, streakBroken: true, passRateDrop: true, redStatus: true, noParentTg: true })).toBe(100); // raw=110
  });

  it('computeScore returns 0 when no signals', () => {
    expect(service.computeScore({ absent3Days: false, streakBroken: false, passRateDrop: false, redStatus: false, noParentTg: false })).toBe(0);
  });
});
