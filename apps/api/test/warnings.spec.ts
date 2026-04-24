import { WarningsService } from '../src/warnings/warnings.service';

describe('WarningsService', () => {
  const mockPrisma = {
    warning: {
      create: jest.fn().mockResolvedValue({ id: 'w-1', studentId: 's' }),
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'w-1', studentId: 's' }),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'active' }),
    },
  };
  const mockEvents = { emit: jest.fn() };
  const service = new WarningsService(mockPrisma as any, mockEvents as any);

  beforeEach(() => jest.clearAllMocks());

  it('creates warning and blocks at 3 active', async () => {
    mockPrisma.warning.count.mockResolvedValue(3);

    await service.give({
      tenantId: 't', studentId: 's', givenBy: 'admin',
      reasonType: 'discipline', reasonText: 'Intizom buzilishi',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'blocked_warning' }),
      }),
    );
  });

  it('does not block at 2 active warnings', async () => {
    mockPrisma.warning.count.mockResolvedValue(2);

    await service.give({
      tenantId: 't', studentId: 's', givenBy: 'admin',
      reasonType: 'not_prepared', reasonText: 'Tayyor emas',
    });

    expect(mockPrisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'blocked_warning' } }),
    );
  });

  it('unblocks user when active warnings drop below 3', async () => {
    mockPrisma.warning.count.mockResolvedValue(2);
    await service.cancel('w-id', 'admin', 'Xato berildi');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'active' }),
      }),
    );
  });
});
