import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronService } from '../src/cron/cron.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TelegramService } from '../src/telegram/telegram.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationTemplatesService } from '../src/notification-templates/notification-templates.service';
import { ClickHouseService } from '../src/clickhouse/clickhouse.service';
import { KpiService } from '../src/kpi/kpi.service';
import { XpService } from '../src/gamification/xp.service';

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
};

const mockTelegram = {
  sendMessage: jest.fn(),
  sendToParent: jest.fn(),
  sendTemplate: jest.fn(),
  formatPaymentReminder: jest.fn().mockReturnValue(''),
};
const mockNotifications = { send: jest.fn() };
const mockXp = { award: jest.fn() };
const mockTemplates = {};
const mockClickhouse = {
  isReady: jest.fn(() => false),
  insertEvent: jest.fn(),
};
const mockConfig = { get: jest.fn() };
const mockEvents = { emit: jest.fn() };
const mockKpi = { award: jest.fn(), hasAwardInRange: jest.fn() };

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
        { provide: XpService, useValue: mockXp },
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
      // findMany is called first to fetch ids for event emission.
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
      // unblocks, once to monitor stuck rows (§15.3). We only need to
      // assert it ran — both calls hit `payment.findMany`.
      expect(mockPrisma.payment.findMany).toHaveBeenCalled();
    });
  });
});
