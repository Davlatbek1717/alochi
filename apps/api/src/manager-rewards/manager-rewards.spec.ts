import { ManagerRewardsService } from './manager-rewards.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ManagerRewardsService', () => {
  const prisma = {
    managerReward: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const svc = new ManagerRewardsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('creates a reward record', async () => {
    prisma.managerReward.create.mockResolvedValue({ id: 'r-1' });
    const input = {
      tenantId: 't-1',
      branchId: 'b-1',
      managerId: 'm-1',
      studentId: 's-1',
      type: 'gift',
      title: 'Kitob',
    };
    await svc.create(input);
    expect(prisma.managerReward.create).toHaveBeenCalledWith({ data: input });
  });

  it('lists for a branch ordered by givenAt desc', async () => {
    prisma.managerReward.findMany.mockResolvedValue([]);
    await svc.listForBranch('t-1', 'b-1');
    expect(prisma.managerReward.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', branchId: 'b-1' },
      orderBy: { givenAt: 'desc' },
    });
  });

  it('lists for a student', async () => {
    prisma.managerReward.findMany.mockResolvedValue([]);
    await svc.listForStudent('s-1');
    expect(prisma.managerReward.findMany).toHaveBeenCalledWith({
      where: { studentId: 's-1' },
      orderBy: { givenAt: 'desc' },
    });
  });
});
