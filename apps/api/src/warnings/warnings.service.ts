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

const WARNING_BLOCK_LIMIT = 3;

@Injectable()
export class WarningsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async give(dto: GiveWarningDto) {
    if (!dto.reasonText.trim()) {
      throw new BadRequestException('Ogohlantirish sababi majburiy');
    }

    const warning = await this.prisma.warning.create({ data: dto });

    const activeCount = await this.prisma.warning.count({
      where: { studentId: dto.studentId, isCancelled: false },
    });

    if (activeCount >= WARNING_BLOCK_LIMIT) {
      await this.prisma.user.update({
        where: { id: dto.studentId },
        data: { status: 'blocked_warning' },
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

    if (activeCount < WARNING_BLOCK_LIMIT) {
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
