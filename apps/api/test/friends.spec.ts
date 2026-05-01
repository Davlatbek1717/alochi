import { FriendsService } from '../src/social/friends.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';

/**
 * Spec §5.1: Branch-level friend requests require requester to be 13+ years
 * old (PDPL — Uzbekistan personal data protection law for minors). Group-level
 * friendships (same group, auto-created) bypass the age gate. If birthDate is
 * unknown, the request is allowed but a warning is logged.
 */
describe('FriendsService — branch friendship 13+ age gate', () => {
  function makePrisma(birthDate: Date | null) {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({ birthDate }),
      },
      friendship: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'f1', ...data }),
          ),
      },
    };
  }

  function ageYearsAgo(years: number): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d;
  }

  it('rejects 12-year-old requesting branch friend with AGE_RESTRICTED_BRANCH_FRIENDSHIP code', async () => {
    const prisma = makePrisma(ageYearsAgo(12));
    const svc = new FriendsService(prisma as never);

    await expect(svc.sendRequest('u1', 'u2', 'branch')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'AGE_RESTRICTED_BRANCH_FRIENDSHIP',
      }),
    });
    await expect(svc.sendRequest('u1', 'u2', 'branch')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.friendship.create).not.toHaveBeenCalled();
  });

  it('allows 14-year-old requesting branch friend', async () => {
    const prisma = makePrisma(ageYearsAgo(14));
    const svc = new FriendsService(prisma as never);

    const result = await svc.sendRequest('u1', 'u2', 'branch');
    expect(result).toMatchObject({
      id: 'f1',
      scope: 'branch',
      status: 'pending',
    });
    expect(prisma.friendship.create).toHaveBeenCalled();
  });

  it('allows group-scope friendship regardless of age (12-year-old OK)', async () => {
    const prisma = makePrisma(ageYearsAgo(12));
    const svc = new FriendsService(prisma as never);

    const result = await svc.sendRequest('u1', 'u2', 'group');
    expect(result).toMatchObject({ scope: 'group' });
    // Age gate is skipped entirely for group scope — birthDate not even read.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.friendship.create).toHaveBeenCalled();
  });

  it('allows branch friendship when birthDate is null (warning logged)', async () => {
    const prisma = makePrisma(null);
    const svc = new FriendsService(prisma as never);
    const warnSpy = jest
      .spyOn(
        (svc as never as { logger: { warn: (m: string) => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    const result = await svc.sendRequest('u1', 'u2', 'branch');
    expect(result).toMatchObject({ scope: 'branch' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown birthDate'),
    );
  });

  it('rejects duplicate friend request with ConflictException', async () => {
    const prisma = makePrisma(ageYearsAgo(20));
    prisma.friendship.findUnique.mockResolvedValueOnce({ id: 'existing' });
    const svc = new FriendsService(prisma as never);

    await expect(svc.sendRequest('u1', 'u2', 'branch')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
