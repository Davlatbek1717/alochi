import { TenantsService } from '../src/tenants/tenants.service';
import { ConflictException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

describe('TenantsService — onboardTenant', () => {
  function makeMockPrisma() {
    const mock = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      branch: {
        create: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    mock.$transaction.mockImplementation(
      async (cb: (tx: typeof mock) => Promise<unknown>) => cb(mock),
    );
    return mock;
  }

  beforeEach(() => jest.clearAllMocks());

  it('creates tenant + admin + branch atomically when all fields valid', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.create.mockResolvedValue({
      id: 't1',
      name: 'Markaz',
      slug: 'markaz',
    });
    mockPrisma.branch.create.mockResolvedValue({ id: 'b1', name: 'Markaziy' });
    mockPrisma.user.create.mockResolvedValue({
      id: 'u1',
      name: 'Akmal',
      login: 'akmal',
    });

    const service = new TenantsService(mockPrisma as never);
    const result = await service.onboardTenant({
      tenant: { name: 'Markaz', slug: 'markaz' },
      admin: { name: 'Akmal', login: 'akmal', password: 'secret123' },
      branch: { name: 'Markaziy' },
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Markaz', slug: 'markaz', status: 'active' },
    });
    expect(mockPrisma.branch.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', name: 'Markaziy' },
    });
    const userCallArg = mockPrisma.user.create.mock.calls[0][0];
    expect(userCallArg.data.tenantId).toBe('t1');
    expect(userCallArg.data.branchId).toBe('b1');
    expect(userCallArg.data.role).toBe(UserRole.filadmin);
    expect(userCallArg.data.passwordHash).toBeDefined();
    expect(userCallArg.data.passwordHash).not.toBe('secret123');
    expect(userCallArg.data.password).toBeUndefined();
    expect(result).toEqual({
      tenant: { id: 't1', name: 'Markaz', slug: 'markaz' },
      admin: { id: 'u1', name: 'Akmal', login: 'akmal' },
      branch: { id: 'b1', name: 'Markaziy' },
    });
  });

  it('creates tenant + admin without branch when branch field omitted', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.create.mockResolvedValue({
      id: 't2',
      name: 'M2',
      slug: 'm2',
    });
    mockPrisma.user.create.mockResolvedValue({
      id: 'u2',
      name: 'B',
      login: 'b',
    });

    const service = new TenantsService(mockPrisma as never);
    const result = await service.onboardTenant({
      tenant: { name: 'M2', slug: 'm2' },
      admin: { name: 'B', login: 'b', password: 'secret123' },
    });

    expect(mockPrisma.branch.create).not.toHaveBeenCalled();
    const userCallArg = mockPrisma.user.create.mock.calls[0][0];
    expect(userCallArg.data.branchId).toBeUndefined();
    expect(result.branch).toBeNull();
  });

  it('throws ConflictException when slug already exists', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'existing',
      slug: 'taken',
    });

    const service = new TenantsService(mockPrisma as never);
    await expect(
      service.onboardTenant({
        tenant: { name: 'X', slug: 'taken' },
        admin: { name: 'A', login: 'a', password: 'secret123' },
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
  });

  it('does not call user.create when branch.create fails (transaction integrity)', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.create.mockResolvedValue({
      id: 't3',
      name: 'M3',
      slug: 'm3',
    });
    mockPrisma.branch.create.mockRejectedValue(new Error('DB error'));

    const service = new TenantsService(mockPrisma as never);
    await expect(
      service.onboardTenant({
        tenant: { name: 'M3', slug: 'm3' },
        admin: { name: 'A', login: 'a', password: 'secret123' },
        branch: { name: 'X' },
      }),
    ).rejects.toThrow('DB error');
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('listAllWithCounts returns tenants with _count.users and _count.branches (newest first)', async () => {
    const mockPrisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            name: 'Markaz Bir',
            slug: 'markaz-bir',
            createdAt: new Date('2026-04-30T00:00:00Z'),
            _count: { users: 12, branches: 3 },
          },
          {
            id: 't2',
            name: 'Markaz Ikki',
            slug: 'markaz-ikki',
            createdAt: new Date('2026-04-01T00:00:00Z'),
            _count: { users: 5, branches: 1 },
          },
        ]),
      },
    };

    const service = new TenantsService(mockPrisma as never);
    const result = await service.listAllWithCounts();

    // Verify select shape includes _count for both relations + ordering
    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { users: true, branches: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 't1',
      slug: 'markaz-bir',
      _count: { users: 12, branches: 3 },
    });
    expect(result[1]._count).toEqual({ users: 5, branches: 1 });
  });

  describe('updateSettings (Phase 5)', () => {
    it('persists warningBlockLimit change for an existing tenant', async () => {
      const mockPrisma = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue({ id: 't1' }),
          update: jest.fn().mockResolvedValue({
            id: 't1',
            name: 'Markaz',
            slug: 'markaz',
            warningBlockLimit: 5,
          }),
        },
      };
      const service = new TenantsService(mockPrisma as never);
      const result = await service.updateSettings('t1', {
        warningBlockLimit: 5,
      });
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { warningBlockLimit: 5 },
        select: {
          id: true,
          name: true,
          slug: true,
          warningBlockLimit: true,
        },
      });
      expect(result.warningBlockLimit).toBe(5);
    });

    it('throws NotFoundException for missing tenant', async () => {
      const mockPrisma = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      const service = new TenantsService(mockPrisma as never);
      await expect(
        service.updateSettings('missing', { warningBlockLimit: 5 }),
      ).rejects.toThrow('Tenant topilmadi');
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe('disable (Phase 17)', () => {
    it('atomically marks tenant inactive and cascades users to status=inactive', async () => {
      const tenantUpdate = jest
        .fn()
        .mockResolvedValue({ id: 't1', isActive: false });
      const usersUpdateMany = jest.fn().mockResolvedValue({ count: 3 });
      const mockPrisma = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue({ id: 't1' }),
          update: tenantUpdate,
        },
        user: {
          updateMany: usersUpdateMany,
        },
        $transaction: jest.fn(async (ops: unknown[]) =>
          Promise.all(ops as Promise<unknown>[]),
        ),
      };

      const service = new TenantsService(mockPrisma as never);
      await service.disable('t1');

      // Both writes were enqueued via $transaction (atomic)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tenantUpdate).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { isActive: false },
      });
      expect(usersUpdateMany).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        data: { status: 'inactive' },
      });
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      const mockPrisma = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        user: { updateMany: jest.fn() },
        $transaction: jest.fn(),
      };
      const service = new TenantsService(mockPrisma as never);
      await expect(service.disable('missing')).rejects.toThrow(
        'Tenant topilmadi',
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('updateName (Phase 17)', () => {
    it('renames an existing tenant', async () => {
      const mockPrisma = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue({ id: 't1' }),
          update: jest.fn().mockResolvedValue({ id: 't1', name: 'New Name' }),
        },
      };
      const service = new TenantsService(mockPrisma as never);
      const result = await service.updateName('t1', 'New Name');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { name: 'New Name' },
      });
      expect(result.name).toBe('New Name');
    });

    it('throws NotFoundException when tenant missing', async () => {
      const mockPrisma = {
        tenant: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      const service = new TenantsService(mockPrisma as never);
      await expect(service.updateName('missing', 'X')).rejects.toThrow(
        'Tenant topilmadi',
      );
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });
  });

  it('converts Prisma P2002 (unique violation) into ConflictException — race-condition safety', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue(null); // pre-check passes (TOCTOU window)
    // Simulate concurrent insert: tenant.create inside transaction throws P2002
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`slug`)',
      { code: 'P2002', clientVersion: '5.0.0' },
    );
    mockPrisma.tenant.create.mockRejectedValue(p2002);

    const service = new TenantsService(mockPrisma as never);
    await expect(
      service.onboardTenant({
        tenant: { name: 'X', slug: 'race' },
        admin: { name: 'A', login: 'a', password: 'secret123' },
      }),
    ).rejects.toThrow(ConflictException);
  });
});
