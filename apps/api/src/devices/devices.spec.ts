import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  device: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  deviceEvent: {
    create: jest.fn(),
  },
  deviceCommand: {
    create: jest.fn(),
  },
};

const mockNotifications = {};
const mockEvents = { emit: jest.fn() };

const TENANT = 'tenant-1';
const DEVICE = { id: 'dev-1', tenantId: TENANT, branchId: 'branch-1' };

describe('DevicesService — MDM hardening (#8, #23)', () => {
  let service: DevicesService;

  beforeEach(() => {
    service = new DevicesService(
      mockPrisma as unknown as PrismaService,
      mockNotifications as unknown as NotificationsService,
      mockEvents as unknown as EventEmitter2,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('rotateToken (#8)', () => {
    it('mints a new token, stamps tokenIssuedAt, and logs a token_rotated event', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(DEVICE);
      mockPrisma.device.update.mockResolvedValue({
        id: DEVICE.id,
        enrollmentToken: 'new-token',
        tokenIssuedAt: new Date(),
      });
      mockPrisma.deviceEvent.create.mockResolvedValue({});

      const result = await service.rotateToken(DEVICE.id, TENANT, 'admin-1');

      expect(result.enrollmentToken).toBe('new-token');
      // The update must write a fresh enrollmentToken + tokenIssuedAt.
      const updateArg = mockPrisma.device.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: DEVICE.id });
      expect(typeof updateArg.data.enrollmentToken).toBe('string');
      expect(updateArg.data.enrollmentToken.length).toBeGreaterThan(0);
      expect(updateArg.data.tokenIssuedAt).toBeInstanceOf(Date);
      // And an audit event is recorded with the actor.
      expect(mockPrisma.deviceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceId: DEVICE.id,
            type: 'token_rotated',
            payload: { rotatedBy: 'admin-1' },
          }),
        }),
      );
    });

    it('throws NotFoundException for an unknown / cross-tenant device', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);
      await expect(
        service.rotateToken('missing', TENANT, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.device.update).not.toHaveBeenCalled();
    });
  });

  describe('forceLogout (#23)', () => {
    it('queues a non-destructive FORCE_LOGOUT command and wakes the device', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(DEVICE);
      mockPrisma.deviceCommand.create.mockResolvedValue({
        id: 'cmd-1',
        type: 'FORCE_LOGOUT',
      });

      const result = await service.forceLogout(DEVICE.id, TENANT, 'admin-1');

      expect(result.type).toBe('FORCE_LOGOUT');
      expect(mockPrisma.deviceCommand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceId: DEVICE.id,
            type: 'FORCE_LOGOUT',
            createdBy: 'admin-1',
          }),
        }),
      );
      // wakeDevice() emits so the long-poll delivers it instantly.
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'device.command',
        expect.objectContaining({ deviceId: DEVICE.id }),
      );
    });
  });

  describe('issueCommand — destructive-command 2FA guard', () => {
    it('refuses WIPE_USER_DATA through the generic command path', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(DEVICE);
      await expect(
        service.issueCommand(
          DEVICE.id,
          TENANT,
          'WIPE_USER_DATA',
          undefined,
          'admin-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.deviceCommand.create).not.toHaveBeenCalled();
    });
  });
});
