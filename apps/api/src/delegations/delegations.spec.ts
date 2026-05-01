import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DelegationsService } from './delegations.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  delegation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  delegationAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  delegationResponse: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

const mockEvents = { emit: jest.fn() };

const baseDto = {
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  fromUserId: 'user-from',
  toUserId: 'user-to',
  delegatedRole: 'filadmin',
  permissions: ['view'],
  reason: 'Going on vacation',
  startsAt: new Date('2026-05-01'),
  endsAt: new Date('2026-05-10'),
};

describe('DelegationsService', () => {
  let service: DelegationsService;

  beforeEach(async () => {
    // Direct construction so we can inject the mock EventEmitter2 without
    // wiring up the full EventEmitterModule in tests.
    service = new DelegationsService(
      mockPrisma as unknown as PrismaService,
      mockEvents as unknown as import('@nestjs/event-emitter').EventEmitter2,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a delegation and audit log when input is valid', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue(null);
      const created = { id: 'del-1', ...baseDto, status: 'pending' };
      mockPrisma.delegation.create.mockResolvedValue(created);
      mockPrisma.delegationAuditLog.create.mockResolvedValue({});

      const result = await service.create(baseDto);

      expect(result).toEqual(created);
      expect(mockPrisma.delegation.create).toHaveBeenCalledWith({
        data: baseDto,
      });
      expect(mockPrisma.delegationAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when reason is blank', async () => {
      await expect(
        service.create({ ...baseDto, reason: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a disallowed delegated role', async () => {
      await expect(
        service.create({ ...baseDto, delegatedRole: 'superadmin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when target user already has an active delegation', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({
        id: 'existing',
        status: 'active',
      });
      await expect(service.create(baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('respond', () => {
    const delegation = { id: 'del-1', toUserId: 'user-to', status: 'pending' };

    it('accepts a pending delegation by the target user', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(delegation);
      const updated = { ...delegation, status: 'active' };
      mockPrisma.delegation.update.mockResolvedValue(updated);
      mockPrisma.delegationResponse.create.mockResolvedValue({});
      mockPrisma.delegationAuditLog.create.mockResolvedValue({});

      const result = await service.respond('del-1', 'user-to', 'accepted');

      expect(result.status).toBe('active');
    });

    it('throws ForbiddenException when a non-target user tries to respond', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(delegation);
      await expect(
        service.respond('del-1', 'other-user', 'accepted'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when rejecting without a reason', async () => {
      await expect(
        service.respond('del-1', 'user-to', 'rejected'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when delegation is not in pending status', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({
        ...delegation,
        status: 'active',
      });
      await expect(
        service.respond('del-1', 'user-to', 'accepted'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when delegation does not exist', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(null);
      await expect(
        service.respond('missing', 'user-to', 'accepted'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException with code DELEGATION_EXPIRED when endsAt < now', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({
        id: 'del-1',
        toUserId: 'user-to',
        status: 'pending',
        endsAt: new Date('2020-01-01'),
      });
      await expect(
        service.respond('del-1', 'user-to', 'accepted'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findForUser scope filter', () => {
    it('returns tenant-wide delegations for superadmin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'sa-1',
        role: 'superadmin',
        tenantId: 't-1',
        branchId: null,
      });
      mockPrisma.delegation.findMany.mockResolvedValue([]);
      await service.findForUser('sa-1');
      expect(mockPrisma.delegation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't-1' } }),
      );
    });

    it('returns participant-only delegations for mentor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'm-1',
        role: 'mentor',
        tenantId: 't-1',
        branchId: 'b-1',
      });
      mockPrisma.delegation.findMany.mockResolvedValue([]);
      await service.findForUser('m-1');
      expect(mockPrisma.delegation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ fromUserId: 'm-1' }, { toUserId: 'm-1' }] },
        }),
      );
    });
  });

  describe('cancel', () => {
    it('cancels a pending delegation', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({
        id: 'del-1',
        status: 'pending',
      });
      const updated = { id: 'del-1', status: 'cancelled' };
      mockPrisma.delegation.update.mockResolvedValue(updated);
      mockPrisma.delegationAuditLog.create.mockResolvedValue({});

      const result = await service.cancel(
        'del-1',
        'user-from',
        'No longer needed',
      );

      expect(result.status).toBe('cancelled');
    });

    it('throws BadRequestException when cancel reason is blank', async () => {
      await expect(service.cancel('del-1', 'user-from', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when delegation is already finished', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({
        id: 'del-1',
        status: 'rejected',
      });
      await expect(
        service.cancel('del-1', 'user-from', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when delegation does not exist', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(null);
      await expect(
        service.cancel('missing', 'user-from', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    const fullDelegation = {
      id: 'del-1',
      ...baseDto,
      status: 'active',
      fromUser: { name: 'Ali' },
      toUser: { name: 'Vali' },
      responses: [],
      auditLogs: [],
    };

    it('returns delegation with relations when it exists', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(fullDelegation);

      const result = await service.findOne('del-1');

      expect(result).toEqual(fullDelegation);
      expect(mockPrisma.delegation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'del-1' } }),
      );
    });

    it('throws NotFoundException when delegation does not exist', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exportToPdf', () => {
    it('returns a Buffer for an existing delegation', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({
        id: 'del-1',
        ...baseDto,
        status: 'active',
        cancelReason: null,
        fromUser: { name: 'Ali' },
        toUser: { name: 'Vali' },
        responses: [],
        auditLogs: [
          {
            performedAt: new Date('2026-05-01T10:00:00Z'),
            actionType: 'delegation_created',
          },
        ],
      });

      const result = await service.exportToPdf('del-1');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
