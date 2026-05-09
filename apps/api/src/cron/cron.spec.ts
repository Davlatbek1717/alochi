import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronService } from './cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTemplatesService } from '../notification-templates/notification-templates.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { KpiService } from '../kpi/kpi.service';

const mockPrisma = {
  paymentSetting: {
    findMany: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  delegation: {
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  attendanceStaff: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  studentStatus: {
    count: jest.fn(),
  },
  spacedRepetitionItem: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
  groupMessage: {
    deleteMany: jest.fn(),
  },
  groupChallenge: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  branch: {
    findUnique: jest.fn(),
  },
  attendanceStudent: {
    count: jest.fn().mockResolvedValue(0),
  },
  warning: {
    count: jest.fn().mockResolvedValue(0),
  },
};

const mockKpi = {
  award: jest.fn(),
  hasAwardInRange: jest.fn(),
  computeMentorDaily: jest
    .fn()
    .mockReturnValue({ totalScore: 5, cappedStudents: 10 }),
};

const mockTelegram = {
  sendMessage: jest.fn(),
  sendToParent: jest.fn(),
  sendTemplate: jest.fn(),
};
const mockNotifications = { send: jest.fn() };
const mockTemplates = {};
const mockClickhouse = {
  isReady: jest.fn(() => false),
  insertEvent: jest.fn(),
};
const mockConfig = { get: jest.fn() };
const mockEvents = { emit: jest.fn() };

describe('CronService', () => {
  let service: CronService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TelegramService, useValue: mockTelegram },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: NotificationTemplatesService, useValue: mockTemplates },
        { provide: ClickHouseService, useValue: mockClickhouse },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: KpiService, useValue: mockKpi },
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
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      mockPrisma.paymentSetting.findMany.mockResolvedValue([
        { tenantId: 't1', paymentEndDay: tomorrow.getDate() === 1 ? 2 : 1 },
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
      mockPrisma.delegation.findMany.mockResolvedValue([]);
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

      // runPaymentUnblock now queries `payment` twice: once to find due
      // unblocks, once to monitor stuck rows (§15.3).
      expect(mockPrisma.payment.findMany).toHaveBeenCalled();
    });
  });

  describe('runMentorKpiCalc', () => {
    it('awards computed KPI points to mentors who checked in today and have not been awarded yet', async () => {
      // groupId is required — mentors without a group are skipped.
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'm1', tenantId: 't1', branchId: 'b1', groupId: 'g1' },
        { id: 'm2', tenantId: 't1', branchId: 'b1', groupId: 'g1' },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(false);
      mockPrisma.attendanceStaff.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrisma.attendanceStudent.count.mockResolvedValue(10);
      mockPrisma.studentStatus.count.mockResolvedValue(5);
      mockPrisma.warning.count.mockResolvedValue(1);
      // computeMentorDaily returns { totalScore: 5 } from the top-level mock.

      await service.runMentorKpiCalc();

      expect(mockKpi.award).toHaveBeenCalledTimes(2);
      expect(mockKpi.award).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'm1',
          tenantId: 't1',
          reason: 'auto_mentor_daily',
        }),
      );
    });

    it('skips mentors who already received auto_mentor_daily today (idempotent)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'm1', tenantId: 't1', branchId: 'b1', groupId: 'g1' },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(true);

      await service.runMentorKpiCalc();

      expect(mockPrisma.attendanceStaff.findFirst).not.toHaveBeenCalled();
      expect(mockKpi.award).not.toHaveBeenCalled();
    });

    it('skips mentors who did NOT check in today', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'm1', tenantId: 't1', branchId: 'b1', groupId: 'g1' },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(false);
      mockPrisma.attendanceStaff.findFirst.mockResolvedValue(null);

      await service.runMentorKpiCalc();

      expect(mockKpi.award).not.toHaveBeenCalled();
    });

    it('skips mentors without a groupId (cannot measure lesson quality)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'm1', tenantId: 't1', branchId: 'b1', groupId: null },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(false);
      mockPrisma.attendanceStaff.findFirst.mockResolvedValue({ id: 'a1' });

      await service.runMentorKpiCalc();

      expect(mockKpi.award).not.toHaveBeenCalled();
    });

    it('swallows internal errors so the cron never bubbles up', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('db down'));
      await expect(service.runMentorKpiCalc()).resolves.toBeUndefined();
    });
  });

  describe('runFiladminMonthlyKpi', () => {
    it('returns early when today is NOT the last day of the month', async () => {
      // Set "today" to the 10th — clearly not last day. We don't need to
      // mock prisma at all because we expect early-return.
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 10, 23, 0, 0)); // April 10 2026

      await service.runFiladminMonthlyKpi();

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('awards BONUS_HIGH (+100) when ratio of green critical >= 80%', async () => {
      // April 30 2026 — last day of April.
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 30, 23, 0, 0));

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'fa1', tenantId: 't1', branchId: 'b1' },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(false);
      mockPrisma.user.count
        .mockResolvedValueOnce(10) // totalStudents
        .mockResolvedValueOnce(0); // blocked
      mockPrisma.studentStatus.count.mockResolvedValue(8); // greenCritical

      await service.runFiladminMonthlyKpi();

      expect(mockKpi.award).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'fa1',
          tenantId: 't1',
          score: 100,
          reason: 'filadmin_monthly_bonus',
        }),
      );
      jest.useRealTimers();
    });

    it('awards PENALTY_LOW (-25) when ratio < 40%', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 30, 23, 0, 0));

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'fa1', tenantId: 't1', branchId: 'b1' },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(false);
      mockPrisma.user.count
        .mockResolvedValueOnce(10) // totalStudents
        .mockResolvedValueOnce(0); // blocked
      mockPrisma.studentStatus.count.mockResolvedValue(2); // 20% green

      await service.runFiladminMonthlyKpi();

      expect(mockKpi.award).toHaveBeenCalledWith(
        expect.objectContaining({
          score: -25,
          reason: 'filadmin_monthly_penalty',
        }),
      );
      jest.useRealTimers();
    });

    it('applies extra blocked penalty when blocked ratio > 10%', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 30, 23, 0, 0));

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'fa1', tenantId: 't1', branchId: 'b1' },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(false);
      mockPrisma.user.count
        .mockResolvedValueOnce(10) // totalStudents
        .mockResolvedValueOnce(2); // blocked = 20% > 10%
      mockPrisma.studentStatus.count.mockResolvedValue(8); // 80% green = +100

      await service.runFiladminMonthlyKpi();

      // 100 + (-25) = 75 → still positive bonus
      expect(mockKpi.award).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 75,
          reason: 'filadmin_monthly_bonus',
        }),
      );
      jest.useRealTimers();
    });

    it('skips filadmin who was already awarded this month (idempotent)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 30, 23, 0, 0));

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'fa1', tenantId: 't1', branchId: 'b1' },
      ]);
      mockKpi.hasAwardInRange
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.runFiladminMonthlyKpi();

      expect(mockPrisma.user.count).not.toHaveBeenCalled();
      expect(mockKpi.award).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('skips branches with zero students', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 30, 23, 0, 0));

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'fa1', tenantId: 't1', branchId: 'b1' },
      ]);
      mockKpi.hasAwardInRange.mockResolvedValue(false);
      mockPrisma.user.count
        .mockResolvedValueOnce(0) // totalStudents = 0
        .mockResolvedValueOnce(0);
      mockPrisma.studentStatus.count.mockResolvedValue(0);

      await service.runFiladminMonthlyKpi();

      expect(mockKpi.award).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
