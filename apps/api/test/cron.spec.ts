import { CronService } from '../src/cron/cron.service';

describe('CronService', () => {
  const mockPrisma = {
    user: {
      updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      findMany: jest.fn().mockResolvedValue([
        { id: 'student-1', name: 'Sardor', status: 'blocked_payment' },
      ]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([
        { studentId: 'student-1', unblockAt: new Date(Date.now() - 1000) },
      ]),
    },
    paymentSetting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    delegation: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const service = new CronService(mockPrisma as any);

  it('unblocks students whose unblock_at has passed', async () => {
    await service.runPaymentUnblock();
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['student-1'] } }),
        data: { status: 'active' },
      }),
    );
  });
});
