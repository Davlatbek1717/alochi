import { Test } from '@nestjs/testing';
import { CronService } from '../src/cron/cron.service';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  paymentSetting: {
    findMany: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
  },
  user: {
    updateMany: jest.fn(),
  },
  delegation: {
    updateMany: jest.fn(),
  },
};

describe('CronService', () => {
  let service: CronService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CronService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('runPaymentUnblock', () => {
    it('does nothing when no payments are due', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);

      await service.runPaymentUnblock();

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('unblocks students whose unblockAt has passed', async () => {
      const duePayments = [{ studentId: 's1' }, { studentId: 's2' }];
      mockPrisma.payment.findMany.mockResolvedValue(duePayments);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 2 });

      await service.runPaymentUnblock();

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            unblockAt: expect.objectContaining({ lte: expect.any(Date) }),
            student: { status: 'blocked_payment' },
          }),
        }),
      );

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['s1', 's2'] }, status: 'blocked_payment' },
        data: { status: 'active' },
      });
    });
  });

  describe('runPaymentBlock', () => {
    it('skips tenants whose paymentEndDay does not match today', async () => {
      const today = new Date();
      const differentDay = today.getDate() === 1 ? 2 : 1;
      mockPrisma.paymentSetting.findMany.mockResolvedValue([
        { tenantId: 't1', paymentEndDay: differentDay },
      ]);

      await service.runPaymentBlock();

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('blocks unpaid students for a tenant whose end day matches today', async () => {
      const today = new Date();
      mockPrisma.paymentSetting.findMany.mockResolvedValue([
        { tenantId: 't1', paymentEndDay: today.getDate() },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([{ studentId: 's1' }]);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 3 });

      await service.runPaymentBlock();

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 't1',
            role: 'student',
            status: 'active',
            id: { notIn: ['s1'] },
          }),
          data: { status: 'blocked_payment' },
        }),
      );
    });
  });

  describe('runDelegationComplete', () => {
    it('completes active delegations whose endsAt has passed', async () => {
      mockPrisma.delegation.updateMany.mockResolvedValue({ count: 2 });

      await service.runDelegationComplete();

      expect(mockPrisma.delegation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
            endsAt: expect.objectContaining({ lte: expect.any(Date) }),
          }),
          data: { status: 'completed' },
        }),
      );
    });
  });

  describe('triggerPaymentUnblockManually', () => {
    it('delegates to runPaymentUnblock', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);

      await service.triggerPaymentUnblockManually();

      expect(mockPrisma.payment.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
