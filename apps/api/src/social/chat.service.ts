import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
// CJS interop: isomorphic-dompurify v2 exports the DOMPurify factory result
// directly via module.exports — no `.default`. Use `import =` to dodge
// `esModuleInterop` injecting an undefined `.default`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import DOMPurify = require('isomorphic-dompurify');
import { PrismaService } from '../prisma/prisma.service';

const MAX_MESSAGE_LENGTH = 200;
const MAX_DAILY_MESSAGES = 20;
const ALLOWED_EMOJIS = ['👍', '🎉', '💪', '🔥', '❤️'];

/**
 * Strip ALL HTML — chat messages are plain text only.
 * DOMPurify with empty allow-lists removes every tag and attribute,
 * which neutralizes XSS payloads like `<img src=x onerror=alert(1)>`.
 */
export function sanitizeChatText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

interface SendMessageDto {
  tenantId: string;
  groupId: string;
  senderId: string;
  content: string;
}

@Injectable()
export class ChatService implements OnModuleInit {
  private keywordCache = new Map<string, Set<string>>();

  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.reloadKeywords();
  }

  async reloadKeywords() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keywords = await (this.prisma as any).chatKeyword.findMany({
      select: { tenantId: true, word: true },
    });
    this.keywordCache.clear();
    for (const kw of keywords as { tenantId: string; word: string }[]) {
      if (!this.keywordCache.has(kw.tenantId)) {
        this.keywordCache.set(kw.tenantId, new Set());
      }
      this.keywordCache.get(kw.tenantId)!.add(kw.word.toLowerCase());
    }
  }

  addKeywordToCache(tenantId: string, word: string) {
    if (!this.keywordCache.has(tenantId)) {
      this.keywordCache.set(tenantId, new Set());
    }
    this.keywordCache.get(tenantId)!.add(word.toLowerCase());
  }

  removeKeywordFromCache(tenantId: string, word: string) {
    this.keywordCache.get(tenantId)?.delete(word.toLowerCase());
  }

  async createKeyword(tenantId: string, word: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kw = await (this.prisma as any).chatKeyword.create({
      data: { tenantId, word: word.trim().toLowerCase() },
    });
    this.addKeywordToCache(tenantId, word);
    return kw;
  }

  getKeywords(tenantId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any).chatKeyword.findMany({
      where: { tenantId },
      orderBy: { word: 'asc' },
    });
  }

  async deleteKeyword(id: string, tenantId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kw = await (this.prisma as any).chatKeyword.delete({ where: { id } });
    this.removeKeywordFromCache(tenantId, kw.word);
    return kw;
  }

  async sendMessage(dto: SendMessageDto) {
    // PHASE 1.6 — XSS hardening: strip every HTML tag/attribute before any
    // further processing. Length and keyword checks run on the sanitized text
    // so a payload like `<script>` cannot smuggle disallowed words past the
    // filter via tag-only camouflage.
    const cleanContent = sanitizeChatText(dto.content);

    if (cleanContent.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Xabar ${MAX_MESSAGE_LENGTH} belgidan uzun bo'lmasligi kerak`,
      );
    }

    const lowerContent = cleanContent.toLowerCase();
    const tenantKeywords = this.keywordCache.get(dto.tenantId);
    if (tenantKeywords) {
      for (const kw of tenantKeywords) {
        if (lowerContent.includes(kw)) {
          throw new BadRequestException(
            "Xabar taqiqlangan so'z o'z ichiga oldi",
          );
        }
      }
    }

    const ban = await this.prisma.chatBan.findFirst({
      where: {
        userId: dto.senderId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (ban) {
      throw new ForbiddenException('Siz chat dan ban olindingiz');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyCount = await this.prisma.groupMessage.count({
      where: {
        senderId: dto.senderId,
        groupId: dto.groupId,
        isDeleted: false,
        createdAt: { gte: today },
      },
    });

    if (dailyCount >= MAX_DAILY_MESSAGES) {
      throw new BadRequestException(
        `Kunlik ${MAX_DAILY_MESSAGES} ta xabar limiti to'ldi`,
      );
    }

    return this.prisma.groupMessage.create({
      data: { ...dto, content: cleanContent },
      include: { sender: { select: { name: true, role: true } } },
    });
  }

  async getGroupMessages(groupId: string, limit = 50) {
    return this.prisma.groupMessage.findMany({
      where: { groupId, isDeleted: false },
      include: {
        sender: { select: { name: true, role: true } },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async deleteMessage(messageId: string, deletedBy: string) {
    return this.prisma.groupMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedBy, deletedAt: new Date() },
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      throw new BadRequestException(
        `Faqat quyidagi emoji ruxsat: ${ALLOWED_EMOJIS.join(' ')}`,
      );
    }

    const reaction = await this.prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });

    // Look up groupId so the gateway can scope `chat:reaction` to the room.
    const message = await this.prisma.groupMessage.findUnique({
      where: { id: messageId },
      select: { groupId: true },
    });
    this.events.emit('chat.reaction', {
      messageId,
      userId,
      emoji,
      groupId: message?.groupId,
    });

    return reaction;
  }

  async banUser(
    userId: string,
    bannedBy: string,
    reason: string,
    expiresAt?: Date,
  ) {
    return this.prisma.chatBan.create({
      data: { userId, bannedBy, reason, expiresAt },
    });
  }
}
