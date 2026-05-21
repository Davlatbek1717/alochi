import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface GiveWarningDto {
  tenantId: string;
  studentId: string;
  givenBy: string;
  reasonType: string;
  reasonText: string;
  delegationId?: string;
}

const DEFAULT_WARNING_BLOCK_LIMIT = 3;

@Injectable()
export class WarningsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  private async getBlockLimit(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { warningBlockLimit: true },
    });
    return tenant?.warningBlockLimit ?? DEFAULT_WARNING_BLOCK_LIMIT;
  }

  async give(dto: GiveWarningDto) {
    if (!dto.reasonText.trim()) {
      throw new BadRequestException('Ogohlantirish sababi majburiy');
    }

    const warning = await this.prisma.warning.create({ data: dto });

    if (dto.delegationId) {
      await this.prisma.delegationAuditLog.create({
        data: {
          delegationId: dto.delegationId,
          actorId: dto.givenBy,
          actionType: 'warning_given',
          targetId: dto.studentId,
          meta: { warningId: warning.id, reasonType: dto.reasonType },
        },
      });
    }

    const [activeCount, blockLimit] = await Promise.all([
      this.prisma.warning.count({
        where: { studentId: dto.studentId, isCancelled: false },
      }),
      this.getBlockLimit(dto.tenantId),
    ]);

    if (activeCount >= blockLimit) {
      const student = await this.prisma.user.findUnique({
        where: { id: dto.studentId },
        select: { status: true },
      });
      await this.prisma.user.update({
        where: { id: dto.studentId },
        data: { status: 'blocked_warning' },
      });
      await this.prisma.userStatusHistory.create({
        data: {
          userId: dto.studentId,
          fromStatus: student?.status ?? 'active',
          toStatus: 'blocked_warning',
          changedBy: dto.givenBy,
          reason: `warning_count_${activeCount}`,
        },
      });
      this.events.emit('student.blocked', {
        studentId: dto.studentId,
        reason: 'warning',
        activeCount,
      });
    } else {
      this.events.emit('warning.given', {
        studentId: dto.studentId,
        count: activeCount,
        warning,
      });
    }

    return { warning, activeCount };
  }

  async cancel(warningId: string, cancelledBy: string, cancelReason: string) {
    if (!cancelReason.trim()) {
      throw new BadRequestException('Bekor qilish sababi majburiy');
    }

    const w = await this.prisma.warning.update({
      where: { id: warningId },
      data: {
        isCancelled: true,
        cancelledBy,
        cancelledAt: new Date(),
        cancelReason,
      },
    });

    const activeCount = await this.prisma.warning.count({
      where: { studentId: w.studentId, isCancelled: false },
    });

    const blockLimit = await this.getBlockLimit(w.tenantId);
    if (activeCount < blockLimit) {
      const student = await this.prisma.user.findUniqueOrThrow({
        where: { id: w.studentId },
      });
      await this.prisma.user.update({
        where: { id: w.studentId },
        data: {
          status:
            student.status === 'blocked_warning' ? 'active' : student.status,
        },
      });
    }

    return { warning: w, activeCount };
  }

  async findByStudent(studentId: string) {
    return this.prisma.warning.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBranch(branchId: string, tenantId: string) {
    return this.prisma.warning.findMany({
      where: {
        tenantId,
        student: { branchId },
        isCancelled: false,
      },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
