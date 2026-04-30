import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram.service';

const COLOR_RANK: Record<string, number> = {
  yashil: 1,
  green: 1,
  sariq: 2,
  yellow: 2,
  qizil: 3,
  red: 3,
};

function compareColors(
  oldColor: string | null,
  newColor: string | null,
): 'worse' | 'improved' | 'same' {
  if (!oldColor || !newColor) return 'same';
  const o = COLOR_RANK[oldColor] ?? 0;
  const n = COLOR_RANK[newColor] ?? 0;
  if (n > o) return 'worse';
  if (n < o) return 'improved';
  return 'same';
}

@Injectable()
export class StatusTelegramHandler {
  private readonly logger = new Logger(StatusTelegramHandler.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  /**
   * Spec §6.3 — manager + parent Telegram on status transitions.
   *   green → yellow / yellow → red (worse) → manager + parent alerts.
   *   red → yellow / yellow → green (improved) → celebratory parent only.
   */
  @OnEvent('status.updated')
  async onStatusUpdated(payload: {
    studentId: string;
    oldColor: string | null;
    newColor: string | null;
    tenantId: string;
  }) {
    try {
      if (!payload.oldColor || !payload.newColor) return;
      const direction = compareColors(payload.oldColor, payload.newColor);
      if (direction === 'same') return;

      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: {
          id: true,
          name: true,
          branchId: true,
          tenantId: true,
          branch: { select: { name: true } },
        },
      });
      if (!student) return;

      if (direction === 'worse') {
        if (student.branchId) {
          const manager = await this.prisma.user.findFirst({
            where: {
              tenantId: student.tenantId,
              branchId: student.branchId,
              role: 'manager',
              status: 'active',
            },
            select: { id: true },
          });
          if (manager) {
            await this.telegram.sendToUser(
              manager.id,
              'status.worse_manager',
              {
                studentName: student.name,
                oldColor: payload.oldColor,
                newColor: payload.newColor,
                branchName: student.branch?.name ?? '',
              },
              student.tenantId,
            );
          }
        }
        await this.telegram.sendToParent(
          student.id,
          'status.worse_parent',
          { newColor: payload.newColor },
          student.tenantId,
        );
      } else if (direction === 'improved') {
        await this.telegram.sendToParent(
          student.id,
          'status.improved_parent',
          { newColor: payload.newColor },
          student.tenantId,
        );
      }
    } catch (err) {
      this.logger.error(`status.updated Telegram xatosi: ${err}`);
    }
  }
}
