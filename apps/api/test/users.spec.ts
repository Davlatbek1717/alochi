import { UsersService } from '../src/users/users.service';
import { UserRole } from '@prisma/client';

describe('UsersService', () => {
  const mockPrisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    warning: {
      findFirst: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates user with hashed password', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null); // no duplicate
    mockPrisma.user.create.mockResolvedValue({ id: 'uuid', role: 'mentor' });

    const mockEvents = { emit: jest.fn() };
    const service = new UsersService(mockPrisma as any, mockEvents as any);
    await service.create({
      tenantId: 'tenant-id',
      branchId: 'branch-id',
      role: UserRole.mentor,
      name: 'Test Mentor',
      login: 'testmentor',
      password: 'Password1!',
    });

    expect(mockPrisma.user.create).toHaveBeenCalled();
    const callArg = mockPrisma.user.create.mock.calls[0][0];
    // Password must be hashed — never stored raw
    expect(callArg.data.passwordHash).toBeDefined();
    expect(callArg.data.passwordHash).not.toBe('Password1!');
    expect(callArg.data.password).toBeUndefined();
  });

  it('throws ConflictException if login already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });

    const mockEvents = { emit: jest.fn() };
    const service = new UsersService(mockPrisma as any, mockEvents as any);
    await expect(
      service.create({
        tenantId: 'tenant-id',
        role: UserRole.mentor,
        name: 'Test',
        login: 'duplicate',
        password: 'Password1!',
      }),
    ).rejects.toThrow('Bu login allaqachon mavjud');
  });

  describe('getBlockStatus', () => {
    it('returns isBlocked=false for active users', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        status: 'active',
      });
      const service = new UsersService(
        mockPrisma as any,
        { emit: jest.fn() } as any,
      );

      const res = await service.getBlockStatus('u1', 't1');
      expect(res).toEqual({
        isBlocked: false,
        reason: null,
        blockedAt: null,
        unblockAt: null,
      });
    });

    it('returns warning reason for blocked_warning users', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        status: 'blocked_warning',
      });
      const createdAt = new Date('2026-04-30T00:00:00.000Z');
      mockPrisma.warning.findFirst.mockResolvedValue({ createdAt });

      const service = new UsersService(
        mockPrisma as any,
        { emit: jest.fn() } as any,
      );
      const res = await service.getBlockStatus('u1', 't1');
      expect(res.isBlocked).toBe(true);
      expect(res.reason).toBe('warning');
      expect(res.blockedAt).toEqual(createdAt);
      expect(res.unblockAt).toBeNull();
    });

    it('returns payment reason with unblockAt for blocked_payment users', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        status: 'blocked_payment',
      });
      const unblockAt = new Date('2026-05-15T00:00:00.000Z');
      mockPrisma.payment.findFirst.mockResolvedValue({
        unblockAt,
        paidAt: new Date('2026-05-01'),
      });

      const service = new UsersService(
        mockPrisma as any,
        { emit: jest.fn() } as any,
      );
      const res = await service.getBlockStatus('u1', 't1');
      expect(res.isBlocked).toBe(true);
      expect(res.reason).toBe('payment');
      expect(res.unblockAt).toEqual(unblockAt);
    });
  });

  describe('findAll — branch scoping (Phase 5)', () => {
    it('manager caller is forced to own branch (ignores query branchId)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const service = new UsersService(
        mockPrisma as any,
        { emit: jest.fn() } as any,
      );

      await service.findAll('t1', 'other-branch', undefined, {
        role: UserRole.manager,
        branchId: 'b-mine',
      });

      const arg = mockPrisma.user.findMany.mock.calls[0][0];
      // Service must override the query branchId with caller's own.
      expect(arg.where.branchId).toBe('b-mine');
    });

    it('superadmin caller honours optional branchId filter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const service = new UsersService(
        mockPrisma as any,
        { emit: jest.fn() } as any,
      );

      await service.findAll('t1', 'b-X', undefined, {
        role: UserRole.superadmin,
        branchId: null,
      });

      const arg = mockPrisma.user.findMany.mock.calls[0][0];
      expect(arg.where.branchId).toBe('b-X');
    });

    it('superadmin caller without branchId filter returns tenant-wide', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const service = new UsersService(
        mockPrisma as any,
        { emit: jest.fn() } as any,
      );

      await service.findAll('t1', undefined, undefined, {
        role: UserRole.superadmin,
        branchId: null,
      });

      const arg = mockPrisma.user.findMany.mock.calls[0][0];
      expect(arg.where.branchId).toBeUndefined();
    });
  });

  describe('unblock', () => {
    it('flips status to active and emits student.unblocked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        status: 'blocked_warning',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', status: 'active' });
      const events = { emit: jest.fn() };
      const service = new UsersService(mockPrisma as any, events as any);

      const res = await service.unblock('u1', 't1', 'admin1', 'Mistake');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'active' },
      });
      expect(events.emit).toHaveBeenCalledWith(
        'student.unblocked',
        expect.objectContaining({
          studentId: 'u1',
          by: 'admin1',
          reason: 'Mistake',
        }),
      );
      expect(res.status).toBe('active');
    });

    it('is no-op for already-active users', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        status: 'active',
      });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'u1',
        status: 'active',
      });
      const events = { emit: jest.fn() };
      const service = new UsersService(mockPrisma as any, events as any);

      await service.unblock('u1', 't1', 'admin1');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });
  });
});
