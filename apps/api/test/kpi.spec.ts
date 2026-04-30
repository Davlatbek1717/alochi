import { KpiService } from '../src/kpi/kpi.service';

describe('KpiService', () => {
  const mockPrisma = {
    kpiScore: {
      create: jest.fn().mockResolvedValue({ id: 'kpi-1', score: 5 }),
      findMany: jest.fn().mockResolvedValue([
        { score: 5, reason: "Dars o'tdi" },
        { score: 10, reason: 'Qizildan sariqqa' },
      ]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { score: 15 } }),
    },
  };
  const service = new KpiService(mockPrisma as any);

  it('awards KPI points with reason', async () => {
    const result = await service.award({
      tenantId: 't',
      userId: 'u',
      score: 5,
      reason: "Dars o'tdi",
    });
    expect(result.score).toBe(5);
  });

  it('returns total KPI for user on date', async () => {
    const total = await service.getDailyTotal('user-id', new Date());
    expect(total).toBe(15);
  });
});
