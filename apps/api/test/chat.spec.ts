import { ChatService } from '../src/social/chat.service';

describe('ChatService', () => {
  const mockPrisma = {
    groupMessage: {
      create: jest.fn().mockResolvedValue({ id: 'msg-1', content: 'Salom' }),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    chatBan: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    messageReaction: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  const service = new ChatService(mockPrisma as any);

  it('blocks message over 200 chars', async () => {
    const longMsg = 'A'.repeat(201);
    await expect(
      service.sendMessage({
        tenantId: 't',
        groupId: 'g',
        senderId: 's',
        content: longMsg,
      }),
    ).rejects.toThrow('200');
  });

  it('blocks sender with 20 messages today', async () => {
    mockPrisma.groupMessage.count.mockResolvedValueOnce(20);
    await expect(
      service.sendMessage({
        tenantId: 't',
        groupId: 'g',
        senderId: 's',
        content: 'Salom',
      }),
    ).rejects.toThrow('20');
  });

  it('blocks banned user', async () => {
    mockPrisma.chatBan.findFirst.mockResolvedValueOnce({
      id: 'ban-1',
      expiresAt: null,
    });
    await expect(
      service.sendMessage({
        tenantId: 't',
        groupId: 'g',
        senderId: 's',
        content: 'Salom',
      }),
    ).rejects.toThrow('ban');
  });
});
