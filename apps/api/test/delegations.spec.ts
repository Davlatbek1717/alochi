import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { DelegationsService } from '../src/delegations/delegations.service';
import { DelegationsController } from '../src/delegations/delegations.controller';
import { ROLES_KEY } from '../src/auth/roles.decorator';

describe('DelegationsService', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Test User' }),
    },
    delegation: {
      create: jest.fn().mockResolvedValue({ id: 'del-1', status: 'pending' }),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    delegationResponse: {
      create: jest.fn().mockResolvedValue({}),
    },
    delegationAuditLog: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockEvents = { emit: jest.fn() };
  const service = new DelegationsService(mockPrisma as any, mockEvents as any);

  beforeEach(() => jest.clearAllMocks());

  it('creates delegation and logs it', async () => {
    const result = await service.create({
      tenantId: 't',
      branchId: 'b',
      fromUserId: 'from',
      toUserId: 'to',
      delegatedRole: 'manager',
      permissions: ['warnings'],
      reason: "Ta'tilda ketaman",
      startsAt: new Date(),
      endsAt: new Date(),
    });
    expect(result.status).toBe('pending');
    expect(mockPrisma.delegationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'delegation_created' }),
      }),
    );
  });

  it('requires non-empty reason on creation', async () => {
    await expect(
      service.create({
        tenantId: 't',
        branchId: 'b',
        fromUserId: 'from',
        toUserId: 'to',
        delegatedRole: 'manager',
        permissions: ['warnings'],
        reason: '',
        startsAt: new Date(),
        endsAt: new Date(),
      }),
    ).rejects.toThrow('Sabab majburiy');
  });

  it('requires non-empty reason on rejection', async () => {
    mockPrisma.delegation.findUnique.mockResolvedValue({
      id: 'del-1',
      status: 'pending',
      toUserId: 'to',
    });
    await expect(
      service.respond('del-1', 'to', 'rejected', ''),
    ).rejects.toThrow('Rad etish sababi majburiy');
  });

  it('allows a superadmin to create a delegation (returns pending)', async () => {
    mockPrisma.delegation.findFirst.mockResolvedValue(null);
    const result = await service.create({
      tenantId: 't',
      branchId: 'b',
      fromUserId: 'super',
      toUserId: 'to',
      delegatedRole: 'filadmin',
      permissions: ['users.create'],
      reason: 'Yangi filadmin tayinlash',
      startsAt: new Date(),
      endsAt: new Date(),
    });
    expect(result.status).toBe('pending');
  });
});

describe('DelegationsController — RBAC (Phase 5)', () => {
  // Per spec §2.3.4: superadmin gains delegation-create rights.
  // Manager was removed: managers only execute delegations, not create them.
  const reflector = new Reflector();
  it('POST /delegations allows filadmin and superadmin only', () => {
    const roles = reflector.get<UserRole[]>(
      ROLES_KEY,
      DelegationsController.prototype.create,
    );
    expect(roles).toContain(UserRole.filadmin);
    expect(roles).toContain(UserRole.superadmin);
    expect(roles).not.toContain(UserRole.manager);
  });
});
