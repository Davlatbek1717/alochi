import { sanitizeChatText, ChatService } from '../src/social/chat.service';

describe('Chat XSS sanitization (Phase 1.6)', () => {
  describe('sanitizeChatText()', () => {
    it('strips img-onerror payload', () => {
      const input = '<img src=x onerror=alert(1)>hello';
      expect(sanitizeChatText(input)).toBe('hello');
    });

    it('strips script tag and contents', () => {
      const input = '<script>evil()</script>safe';
      expect(sanitizeChatText(input)).toBe('safe');
    });

    it('strips bold tags (no tags allowed)', () => {
      const input = '<b>plain bold</b>';
      expect(sanitizeChatText(input)).toBe('plain bold');
    });

    it('strips nested tags + event handlers', () => {
      const input = '<div onclick="x"><span>a<b>b</b>c</span></div>';
      expect(sanitizeChatText(input)).toBe('abc');
    });

    it('preserves benign plain text and emoji', () => {
      const input = 'Salom 👍 dunyo!';
      expect(sanitizeChatText(input)).toBe(input);
    });

    it('strips javascript: URLs masquerading as text', () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      expect(sanitizeChatText(input)).toBe('click');
    });
  });

  describe('ChatService.sendMessage()', () => {
    it('persists sanitized content, not the raw HTML', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'msg-1' });
      const mockPrisma = {
        groupMessage: { create, count: jest.fn().mockResolvedValue(0) },
        chatBan: { findFirst: jest.fn().mockResolvedValue(null) },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chatKeyword: { findMany: jest.fn().mockResolvedValue([] as any[]) },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ branchId: null, branch: null }),
        },
      };
      const mockEvents = { emit: jest.fn() } as never;
      const svc = new ChatService(mockPrisma as never, mockEvents);
      // skip onModuleInit to avoid touching prisma
      await svc.sendMessage({
        tenantId: 't',
        groupId: 'g',
        senderId: 's',
        content: '<script>evil()</script>safe',
      });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: 'safe' }),
        }),
      );
    });
  });
});
