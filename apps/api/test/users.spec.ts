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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates user with hashed password', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null); // no duplicate
    mockPrisma.user.create.mockResolvedValue({ id: 'uuid', role: 'mentor' });

    const service = new UsersService(mockPrisma as any);
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

    const service = new UsersService(mockPrisma as any);
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
});
