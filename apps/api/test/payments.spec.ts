import { PaymentsService } from '../src/payments/payments.service';

describe('PaymentsService', () => {
  const mockPrisma = {
    payment: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'blocked_payment' }),
    },
    paymentSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  const service = new PaymentsService(mockPrisma as any);

  it('marks payment and sets unblock_at to next day midnight', async () => {
    const paidAt = new Date('2026-05-10T14:00:00Z');
    mockPrisma.payment.upsert.mockResolvedValue({ unblockAt: paidAt });

    await service.markPaid({
      tenantId: 't', studentId: 's', recordedBy: 'filadmin',
      month: '2026-05', amount: 500000, paidAt,
    });

    const callArg = mockPrisma.payment.upsert.mock.calls[0][0];
    const unblockAt: Date = callArg.create.unblockAt;
    expect(unblockAt.getDate()).toBe(paidAt.getDate() + 1);
    expect(unblockAt.getHours()).toBe(0);
    expect(unblockAt.getMinutes()).toBe(0);
  });
});
