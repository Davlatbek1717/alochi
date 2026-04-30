import { ChallengeService } from '../src/social/challenge.service';
import { BadRequestException } from '@nestjs/common';

describe('ChallengeService — Phase 19 limits', () => {
  function makeMocks() {
    return {
      user: {
        findMany: jest.fn(),
      },
      groupChallenge: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'ch-1' }),
      },
    };
  }

  it('rejects same-group challenge', async () => {
    const prisma = makeMocks();
    const svc = new ChallengeService(prisma as never);
    await expect(svc.create('t', 'g-1', 'g-1', new Date())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects cross-branch challenge with CHALLENGE_CROSS_BRANCH code', async () => {
    const prisma = makeMocks();
    prisma.user.findMany
      .mockResolvedValueOnce([{ branchId: 'br-A' }, { branchId: 'br-A' }])
      .mockResolvedValueOnce([{ branchId: 'br-B' }]);
    const svc = new ChallengeService(prisma as never);
    await expect(svc.create('t', 'g-1', 'g-2', new Date())).rejects.toThrow(
      /CHALLENGE_CROSS_BRANCH|filial/,
    );
  });

  it('rejects when month-2 cap is reached', async () => {
    const prisma = makeMocks();
    prisma.user.findMany
      .mockResolvedValueOnce([{ branchId: 'br' }])
      .mockResolvedValueOnce([{ branchId: 'br' }]);
    prisma.groupChallenge.count.mockResolvedValueOnce(2); // monthCount
    const svc = new ChallengeService(prisma as never);
    await expect(svc.create('t', 'g-1', 'g-2', new Date())).rejects.toThrow(
      /limiti|LIMIT/i,
    );
  });

  it('rejects when an active challenge already exists', async () => {
    const prisma = makeMocks();
    prisma.user.findMany
      .mockResolvedValueOnce([{ branchId: 'br' }])
      .mockResolvedValueOnce([{ branchId: 'br' }]);
    prisma.groupChallenge.count
      .mockResolvedValueOnce(0) // monthCount
      .mockResolvedValueOnce(1); // activeCount
    const svc = new ChallengeService(prisma as never);
    await expect(svc.create('t', 'g-1', 'g-2', new Date())).rejects.toThrow(
      /Faol challenge|LIMIT/i,
    );
  });

  it('creates challenge when within limits and same branch', async () => {
    const prisma = makeMocks();
    prisma.user.findMany
      .mockResolvedValueOnce([{ branchId: 'br' }])
      .mockResolvedValueOnce([{ branchId: 'br' }]);
    prisma.groupChallenge.count
      .mockResolvedValueOnce(1) // monthCount
      .mockResolvedValueOnce(0); // activeCount
    const svc = new ChallengeService(prisma as never);
    const out = await svc.create('t', 'g-1', 'g-2', new Date());
    expect(out).toEqual({ id: 'ch-1' });
    expect(prisma.groupChallenge.create).toHaveBeenCalled();
  });
});
