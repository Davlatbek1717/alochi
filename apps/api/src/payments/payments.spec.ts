import { Test } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  payment: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  paymentSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  branch: {
    findMany: jest.fn(),
  },
  delegationAuditLog: {
    create: jest.fn(),
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

    beforeEach(() => {
      // Default: no existing payment, so markPaid proceeds to upsert.
      mockPrisma.payment.findUnique.mockResolvedValue(null);
    });

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

    it('writes a DelegationAuditLog row when delegationId is provided', async () => {
      const expectedRecord = { id: 'pay-7', ...baseDto };
      mockPrisma.payment.upsert.mockResolvedValue(expectedRecord);
      mockPrisma.delegationAuditLog.create.mockResolvedValue({});

      await service.markPaid({ ...baseDto, delegationId: 'del-1' });

      expect(mockPrisma.delegationAuditLog.create).toHaveBeenCalledWith({
        data: {
          delegationId: 'del-1',
          actorId: baseDto.recordedBy,
          actionType: 'payment_marked',
          targetId: baseDto.studentId,
          meta: {
            paymentId: expectedRecord.id,
            month: baseDto.month,
            amount: baseDto.amount,
          },
        },
      });
    });

    it('does NOT write a DelegationAuditLog row when delegationId is absent', async () => {
      mockPrisma.payment.upsert.mockResolvedValue({ id: 'pay-8', ...baseDto });

      await service.markPaid(baseDto);

      expect(mockPrisma.delegationAuditLog.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException with PAYMENT_ALREADY_MARKED when payment already exists for that month', async () => {
      const paidAt = new Date('2025-04-10T08:00:00.000Z');
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'existing-pay',
        studentId: 's1',
        month: '2025-04',
        paidAt,
      });

      await expect(service.markPaid(baseDto)).rejects.toMatchObject({
        response: {
          code: 'PAYMENT_ALREADY_MARKED',
          details: { month: '2025-04', paidAt },
        },
      });
      expect(mockPrisma.payment.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.delegationAuditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getStudentPayments', () => {
    it('returns payments for student ordered by month desc', async () => {
      const payments = [
        { id: 'p1', month: '2025-04' },
        { id: 'p2', month: '2025-03' },
      ];
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

      const result = await service.getBranchPaymentStatus(
        'b1',
        't1',
        '2025-04',
      );

      expect(result).toHaveLength(2);
      expect(result.find((r: { id: string }) => r.id === 's1')?.hasPaid).toBe(
        true,
      );
      expect(result.find((r: { id: string }) => r.id === 's2')?.hasPaid).toBe(
        false,
      );
      expect(
        result.find((r: { id: string }) => r.id === 's2')?.payment,
      ).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('calls paymentSetting upsert with correct payload', async () => {
      mockPrisma.paymentSetting.upsert.mockResolvedValue({});

      await service.updateSettings('t1', 1, 25, 'admin1');

      expect(mockPrisma.paymentSetting.upsert).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        create: {
          tenantId: 't1',
          paymentStartDay: 1,
          paymentEndDay: 25,
          updatedBy: 'admin1',
        },
        update: { paymentStartDay: 1, paymentEndDay: 25, updatedBy: 'admin1' },
      });
    });
  });

  describe('getBranchSummary', () => {
    it('returns per-branch totals for paid, unpaid, and blocked students', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'Toshkent' },
        { id: 'b2', name: 'Samarqand' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 's1', branchId: 'b1', status: 'active' },
        { id: 's2', branchId: 'b1', status: 'blocked_payment' },
        { id: 's3', branchId: 'b1', status: 'active' },
        { id: 's4', branchId: 'b2', status: 'active' },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([
        { studentId: 's1', amount: 500000 },
        { studentId: 's4', amount: 600000 },
      ]);

      const result = await service.getBranchSummary('t1', '2026-04');

      expect(result).toHaveLength(2);

      const b1 = result.find((r) => r.branchId === 'b1')!;
      expect(b1.branchName).toBe('Toshkent');
      expect(b1.total).toBe(3);
      expect(b1.paid).toBe(1);
      expect(b1.blocked).toBe(1);
      expect(b1.unpaid).toBe(1);
      expect(b1.totalCollected).toBe(500000);

      const b2 = result.find((r) => r.branchId === 'b2')!;
      expect(b2.paid).toBe(1);
      expect(b2.totalCollected).toBe(600000);
    });

    it('returns zero counts for a branch with no students', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'Empty Branch' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const result = await service.getBranchSummary('t1', '2026-04');

      expect(result[0].total).toBe(0);
      expect(result[0].paid).toBe(0);
      expect(result[0].totalCollected).toBe(0);
    });

    it('counts a blocked_payment student who has paid as paid, not blocked', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'Test' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 's1', branchId: 'b1', status: 'blocked_payment' },
        { id: 's2', branchId: 'b1', status: 'active' },
      ]);
      // s1 has paid even though still blocked_payment status
      mockPrisma.payment.findMany.mockResolvedValue([
        { studentId: 's1', amount: 300000 },
      ]);

      const result = await service.getBranchSummary('t1', '2026-04');

      const b1 = result[0];
      expect(b1.total).toBe(2);
      expect(b1.paid).toBe(1); // s1 paid
      expect(b1.blocked).toBe(0); // s1 should NOT be in blocked (paid takes precedence)
      expect(b1.unpaid).toBe(1); // s2 is unpaid
      expect(b1.paid + b1.unpaid + b1.blocked).toBe(b1.total);
    });

    it('passes tenantId to all three Prisma queries', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.payment.findMany.mockResolvedValue([]);

      await service.getBranchSummary('tenant-xyz', '2026-04');

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-xyz' }),
        }),
      );
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-xyz' }),
        }),
      );
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-xyz' }),
        }),
      );
    });
  });
});
