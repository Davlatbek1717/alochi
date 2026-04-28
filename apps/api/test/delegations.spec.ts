import { DelegationsService } from '../src/delegations/delegations.service';

describe('DelegationsService', () => {
  const mockPrisma = {
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
      tenantId: 't', branchId: 'b', fromUserId: 'from', toUserId: 'to',
      delegatedRole: 'manager', permissions: ['warnings'],
      reason: "Ta'tilda ketaman", startsAt: new Date(), endsAt: new Date(),
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
        tenantId: 't', branchId: 'b', fromUserId: 'from', toUserId: 'to',
        delegatedRole: 'manager', permissions: ['warnings'],
        reason: '',
        startsAt: new Date(), endsAt: new Date(),
      }),
    ).rejects.toThrow('Sabab majburiy');
  });

  it('requires non-empty reason on rejection', async () => {
    mockPrisma.delegation.findUnique.mockResolvedValue({
      id: 'del-1', status: 'pending', toUserId: 'to',
    });
    await expect(
      service.respond('del-1', 'to', 'rejected', ''),
    ).rejects.toThrow('Rad etish sababi majburiy');
  });
});
