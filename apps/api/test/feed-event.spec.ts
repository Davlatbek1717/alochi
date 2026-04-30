import { FeedEventService } from '../src/social/feed-event.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('FeedEventService — Phase 19 reactions', () => {
  function makeService() {
    const prisma = {
      socialFeedEvent: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'evt-1', actorId: 'actor-1' }),
        create: jest.fn(),
      },
      feedEventReaction: {
        upsert: jest.fn().mockResolvedValue({ id: 'r-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      friendship: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const gateway = { emitToUser: jest.fn(), broadcastFeedEvent: jest.fn() };
    const svc = new FeedEventService(prisma as never, gateway as never);
    return { svc, prisma, gateway };
  }

  it('rejects invalid emoji', async () => {
    const { svc } = makeService();
    await expect(svc.addReaction('evt-1', 'u-1', '😈')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException for missing event', async () => {
    const { svc, prisma } = makeService();
    prisma.socialFeedEvent.findUnique.mockResolvedValueOnce(null);
    await expect(svc.addReaction('missing', 'u-1', '👍')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('upserts reaction and emits feed:reaction to actor', async () => {
    const { svc, prisma, gateway } = makeService();
    const result = await svc.addReaction('evt-1', 'u-1', '🔥');
    expect(result).toEqual({ id: 'r-1' });
    expect(prisma.feedEventReaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'evt-1', userId: 'u-1' } },
      }),
    );
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'actor-1',
      'feed:reaction',
      { eventId: 'evt-1', userId: 'u-1', emoji: '🔥' },
    );
  });
});
