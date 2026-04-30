import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  warning: {
    findFirst: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
  },
  delegationAuditLog: {
    create: jest.fn(),
  },
};

const mockEvents = {
  emit: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findByGroup', () => {
    it('returns users scoped to groupId + tenantId, only active', async () => {
      const fakeUsers = [
        {
          id: 'u1',
          name: 'Aliyev',
          role: 'student',
          status: 'active',
          phone: null,
          login: 'aliyev',
          branchId: 'b1',
          groupId: 'g1',
        },
        {
          id: 'u2',
          name: 'Bekov',
          role: 'student',
          status: 'active',
          phone: null,
          login: 'bekov',
          branchId: 'b1',
          groupId: 'g1',
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(fakeUsers);

      const result = await service.findByGroup('g1', 't1');

      expect(result).toEqual(fakeUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
      const call = mockPrisma.user.findMany.mock.calls[0][0];
      expect(call.where).toEqual({
        groupId: 'g1',
        tenantId: 't1',
        status: 'active',
      });
      expect(call.orderBy).toEqual({ name: 'asc' });
      expect(call.select).toMatchObject({
        id: true,
        name: true,
        role: true,
        groupId: true,
        branchId: true,
      });
    });

    it('does not leak users from other tenants', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.findByGroup('g1', 'tenant-A');

      const where = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe('tenant-A');
    });

    it('returns empty array when group has no active users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const result = await service.findByGroup('empty-group', 't1');
      expect(result).toEqual([]);
    });
  });
});
