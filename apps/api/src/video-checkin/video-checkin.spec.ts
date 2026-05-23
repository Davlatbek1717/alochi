import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VideoCheckinService } from './video-checkin.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
  },
};

const mockEvents = { emit: jest.fn() };
const mockConfig = { get: jest.fn() };

// The student record assertCanViewStudent loads (branch/group it belongs to).
const STUDENT = { branchId: 'branch-1', groupId: 'group-1' };

function caller(
  role: string,
  over: Partial<{
    userId: string;
    tenantId: string;
    branchId: string | null;
    groupId: string | null;
  }> = {},
) {
  return {
    role,
    userId: over.userId ?? 'caller-1',
    tenantId: over.tenantId ?? 'tenant-1',
    branchId: over.branchId ?? 'branch-1',
    groupId: over.groupId ?? 'group-1',
  };
}

describe('VideoCheckinService.assertCanViewStudent (#17 IDOR scope)', () => {
  let service: VideoCheckinService;

  beforeEach(() => {
    service = new VideoCheckinService(
      mockPrisma as unknown as PrismaService,
      mockEvents as unknown as EventEmitter2,
      mockConfig as unknown as ConfigService,
    );
    mockPrisma.user.findFirst.mockResolvedValue(STUDENT);
  });

  afterEach(() => jest.clearAllMocks());

  it('lets a student view only their own record (no DB lookup)', async () => {
    await expect(
      service.assertCanViewStudent(
        'stu-1',
        caller('student', { userId: 'stu-1' }),
      ),
    ).resolves.toBeUndefined();
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('blocks a student from viewing another student (the IDOR case)', async () => {
    await expect(
      service.assertCanViewStudent(
        'stu-2',
        caller('student', { userId: 'stu-1' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets superadmin view any student in the tenant', async () => {
    await expect(
      service.assertCanViewStudent('stu-1', caller('superadmin')),
    ).resolves.toBeUndefined();
  });

  it('lets filadmin view a student in the same branch', async () => {
    await expect(
      service.assertCanViewStudent(
        'stu-1',
        caller('filadmin', { branchId: 'branch-1' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('blocks filadmin from a student in a different branch', async () => {
    await expect(
      service.assertCanViewStudent(
        'stu-1',
        caller('filadmin', { branchId: 'branch-9' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets a mentor view a student in the same group', async () => {
    await expect(
      service.assertCanViewStudent(
        'stu-1',
        caller('mentor', { groupId: 'group-1' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('blocks a mentor from a student in a different group', async () => {
    await expect(
      service.assertCanViewStudent(
        'stu-1',
        caller('mentor', { groupId: 'group-9' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets a manager view a student in the same branch', async () => {
    await expect(
      service.assertCanViewStudent(
        'stu-1',
        caller('manager', { branchId: 'branch-1' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('throws NotFoundException when the student does not exist in the tenant', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.assertCanViewStudent('ghost', caller('superadmin')),
    ).rejects.toThrow(NotFoundException);
  });
});
