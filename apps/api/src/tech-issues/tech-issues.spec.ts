import { TechIssuesService } from './tech-issues.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TechIssuesService', () => {
  const prisma = {
    techIssue: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const svc = new TechIssuesService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('creates a tech issue with default severity', async () => {
    prisma.techIssue.create.mockResolvedValue({ id: 'i-1' });
    await svc.create({
      tenantId: 't-1',
      branchId: null,
      reportedBy: 'u-1',
      category: 'tablet',
      description: 'Stuck',
    });
    expect(prisma.techIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ severity: 'medium' }),
    });
  });

  it('resolves an issue, sets status and resolvedAt', async () => {
    prisma.techIssue.update.mockResolvedValue({ id: 'i-1' });
    await svc.resolve('i-1', 'Restarted device');
    expect(prisma.techIssue.update).toHaveBeenCalledWith({
      where: { id: 'i-1' },
      data: expect.objectContaining({
        status: 'resolved',
        resolution: 'Restarted device',
      }),
    });
  });

  it('lists by tenant filtering by status', async () => {
    prisma.techIssue.findMany.mockResolvedValue([]);
    await svc.list('t-1', { status: 'open' });
    expect(prisma.techIssue.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't-1', status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
