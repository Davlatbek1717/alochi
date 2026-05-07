import { ChatService } from '../src/social/chat.service';

describe('ChatService', () => {
  const mockPrisma = {
    groupMessage: {
      create: jest.fn().mockResolvedValue({ id: 'msg-1', content: 'Salom' }),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ groupId: 'g' }),
    },
    chatBan: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    messageReaction: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ branchId: null, branch: null }),
    },
    branch: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const mockEvents = { emit: jest.fn() };
  const service = new ChatService(mockPrisma as any, mockEvents as any);

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

  it('rejects message with CHAT_LOCKED when branch is locked', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      branchId: 'br-1',
      branch: { chatLocked: true },
    });
    await expect(
      service.sendMessage({
        tenantId: 't',
        groupId: 'g',
        senderId: 's',
        content: 'Salom',
      }),
    ).rejects.toThrow(/CHAT_LOCKED|yopilgan/);
  });

  it('approveMessage flips status to approved + emits chat.message_approved', async () => {
    mockPrisma.groupMessage.update.mockResolvedValueOnce({
      id: 'msg-1',
      groupId: 'g',
      senderId: 's',
      moderationStatus: 'approved',
    });
    await service.approveMessage('msg-1', 'mod-1');
    expect(mockEvents.emit).toHaveBeenCalledWith(
      'chat.message_approved',
      expect.objectContaining({ messageId: 'msg-1' }),
    );
  });

  it('pinMessage flips isPinned + emits chat.pinned', async () => {
    mockPrisma.groupMessage.update.mockResolvedValueOnce({
      id: 'msg-1',
      groupId: 'g',
      senderId: 's',
      isPinned: true,
    });
    await service.pinMessage('msg-1', 'mod-1');
    expect(mockEvents.emit).toHaveBeenCalledWith(
      'chat.pinned',
      expect.objectContaining({ messageId: 'msg-1', pinnedBy: 'mod-1' }),
    );
  });
});
