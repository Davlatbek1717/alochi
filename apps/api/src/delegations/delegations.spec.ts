import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
};

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
    const module = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(DelegationsService);
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
      expect(mockPrisma.delegation.create).toHaveBeenCalledWith({ data: baseDto });
      expect(mockPrisma.delegationAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when reason is blank', async () => {
      await expect(service.create({ ...baseDto, reason: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a disallowed delegated role', async () => {
      await expect(service.create({ ...baseDto, delegatedRole: 'superadmin' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when target user already has an active delegation', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({ id: 'existing', status: 'active' });
      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
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
      await expect(service.respond('del-1', 'other-user', 'accepted')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when rejecting without a reason', async () => {
      await expect(service.respond('del-1', 'user-to', 'rejected')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when delegation is not in pending status', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({ ...delegation, status: 'active' });
      await expect(service.respond('del-1', 'user-to', 'accepted')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when delegation does not exist', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(null);
      await expect(service.respond('missing', 'user-to', 'accepted')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('cancels a pending delegation', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({ id: 'del-1', status: 'pending' });
      const updated = { id: 'del-1', status: 'cancelled' };
      mockPrisma.delegation.update.mockResolvedValue(updated);
      mockPrisma.delegationAuditLog.create.mockResolvedValue({});

      const result = await service.cancel('del-1', 'user-from', 'No longer needed');

      expect(result.status).toBe('cancelled');
    });

    it('throws BadRequestException when cancel reason is blank', async () => {
      await expect(service.cancel('del-1', 'user-from', '')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when delegation is already finished', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue({ id: 'del-1', status: 'rejected' });
      await expect(service.cancel('del-1', 'user-from', 'reason')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when delegation does not exist', async () => {
      mockPrisma.delegation.findUnique.mockResolvedValue(null);
      await expect(service.cancel('missing', 'user-from', 'reason')).rejects.toThrow(NotFoundException);
    });
  });
});
