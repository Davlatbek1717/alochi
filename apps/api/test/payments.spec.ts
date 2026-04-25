import { Test } from '@nestjs/testing';
import { PaymentsService } from '../src/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  payment: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  paymentSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('markPaid', () => {
    const baseDto = {
      tenantId: 't1',
      studentId: 's1',
      recordedBy: 'admin1',
      month: '2025-04',
      amount: 500000,
      paidAt: new Date('2025-04-15T12:00:00.000Z'),
    };

    it('calls upsert with correct composite key and unblockAt set to next day midnight', async () => {
      const expectedRecord = { id: 'pay1', ...baseDto };
      mockPrisma.payment.upsert.mockResolvedValue(expectedRecord);

      const result = await service.markPaid(baseDto);

      expect(mockPrisma.payment.upsert).toHaveBeenCalledTimes(1);
      const call = mockPrisma.payment.upsert.mock.calls[0][0];
      expect(call.where).toEqual({
        studentId_month: { studentId: 's1', month: '2025-04' },
      });

      const unblockAt: Date = call.create.unblockAt;
      expect(unblockAt.getDate()).toBe(new Date('2025-04-16').getDate());
      expect(unblockAt.getHours()).toBe(0);
      expect(unblockAt.getMinutes()).toBe(0);
      expect(unblockAt.getSeconds()).toBe(0);

      expect(result).toEqual(expectedRecord);
    });

    it('update payload only contains amount, paidAt, recordedBy, unblockAt', async () => {
      mockPrisma.payment.upsert.mockResolvedValue({});
      await service.markPaid(baseDto);

      const call = mockPrisma.payment.upsert.mock.calls[0][0];
      expect(Object.keys(call.update)).toEqual(
        expect.arrayContaining(['amount', 'paidAt', 'recordedBy', 'unblockAt']),
      );
      expect(call.update).not.toHaveProperty('studentId');
      expect(call.update).not.toHaveProperty('month');
    });
  });

  describe('getStudentPayments', () => {
    it('returns payments for student ordered by month desc', async () => {
      const payments = [{ id: 'p1', month: '2025-04' }, { id: 'p2', month: '2025-03' }];
      mockPrisma.payment.findMany.mockResolvedValue(payments);

      const result = await service.getStudentPayments('s1');

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: { studentId: 's1' },
        orderBy: { month: 'desc' },
      });
      expect(result).toEqual(payments);
    });
  });

  describe('getBranchPaymentStatus', () => {
    it('marks hasPaid correctly for each student', async () => {
      const students = [
        { id: 's1', name: 'Alice', status: 'active' },
        { id: 's2', name: 'Bob', status: 'active' },
      ];
      const payments = [
        { studentId: 's1', amount: 500000, paidAt: new Date() },
      ];
      mockPrisma.user.findMany.mockResolvedValue(students);
      mockPrisma.payment.findMany.mockResolvedValue(payments);

      const result = await service.getBranchPaymentStatus('b1', 't1', '2025-04');

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.id === 's1')?.hasPaid).toBe(true);
      expect(result.find((r) => r.id === 's2')?.hasPaid).toBe(false);
      expect(result.find((r) => r.id === 's2')?.payment).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('calls paymentSetting upsert with correct payload', async () => {
      mockPrisma.paymentSetting.upsert.mockResolvedValue({});

      await service.updateSettings('t1', 1, 25, 'admin1');

      expect(mockPrisma.paymentSetting.upsert).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        create: { tenantId: 't1', paymentStartDay: 1, paymentEndDay: 25, updatedBy: 'admin1' },
        update: { paymentStartDay: 1, paymentEndDay: 25, updatedBy: 'admin1' },
      });
    });
  });
});
