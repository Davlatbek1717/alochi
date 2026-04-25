import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_MESSAGE_LENGTH = 200;
const MAX_DAILY_MESSAGES = 20;
const ALLOWED_EMOJIS = ['👍', '🎉', '💪', '🔥', '❤️'];

interface SendMessageDto {
  tenantId: string;
  groupId: string;
  senderId: string;
  content: string;
}

@Injectable()
export class ChatService {
  private blockedKeywords: string[] = [];

  constructor(private prisma: PrismaService) {}

  async sendMessage(dto: SendMessageDto) {
    if (dto.content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Xabar ${MAX_MESSAGE_LENGTH} belgidan uzun bo'lmasligi kerak`,
      );
    }

    const lowerContent = dto.content.toLowerCase();
    for (const kw of this.blockedKeywords) {
      if (lowerContent.includes(kw.toLowerCase())) {
        throw new BadRequestException("Xabar taqiqlangan so'z o'z ichiga oldi");
      }
    }

    const ban = await this.prisma.chatBan.findFirst({
      where: {
        userId: dto.senderId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
      data: dto,
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

    return this.prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });
  }

  async banUser(userId: string, bannedBy: string, reason: string, expiresAt?: Date) {
    return this.prisma.chatBan.create({
      data: { userId, bannedBy, reason, expiresAt },
    });
  }

  updateKeywords(keywords: string[]) {
    this.blockedKeywords = keywords;
  }
}
