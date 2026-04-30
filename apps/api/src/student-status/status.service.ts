import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SetPersonalStatusDto } from './dto/set-personal-status.dto';
import { SetCriticalStatusDto } from './dto/set-critical-status.dto';

interface ActorContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}

@Injectable()
export class StatusService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  /**
   * Mentor sets the PERSONAL status colour for a student.
   *
   * Auto-yellow logic (spec §5.2):
   *   if new personalStatus === 'yashil'
   *   AND today's englishStatus === 'yashil'
   *   AND prior criticalStatus !== 'yashil'
   *   → criticalStatus is auto-set to 'yashil' and a notification is
   *     emitted to the student's branch manager.
   */
  async setPersonalStatus(actor: ActorContext, dto: SetPersonalStatusDto) {
    const dateObj = dto.date ? new Date(dto.date) : startOfToday();

    const existing = await this.prisma.studentStatus.findUnique({
      where: { studentId_date: { studentId: dto.studentId, date: dateObj } },
    });

    const englishToday = existing?.englishStatus ?? null;
    const previousCritical = existing?.criticalStatus ?? null;
    const oldColor = existing
      ? this.worstColor([
          existing.englishStatus,
          existing.personalStatus,
          existing.criticalStatus,
        ])
      : null;

    const autoGreen =
      dto.color === 'yashil' &&
      englishToday === 'yashil' &&
      previousCritical !== 'yashil';

    const result = await this.prisma.studentStatus.upsert({
      where: { studentId_date: { studentId: dto.studentId, date: dateObj } },
      create: {
        studentId: dto.studentId,
        date: dateObj,
        personalStatus: dto.color,
        personalNote: dto.note,
        ...(autoGreen ? { criticalStatus: 'yashil' } : {}),
      },
      update: {
        personalStatus: dto.color,
        personalNote: dto.note,
        ...(autoGreen ? { criticalStatus: 'yashil' } : {}),
      },
    });

    if (autoGreen) {
      const manager = await this.findBranchManager(dto.studentId);
      if (manager) {
        this.events.emit('notification.new', {
          userId: manager.id,
          tenantId: actor.tenantId,
          type: 'status.auto_green',
          message: "Sardor o'quvchining holati yashilga tushdi (avtomatik)",
          studentId: dto.studentId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const newColor = this.worstColor([
      result.englishStatus,
      result.personalStatus,
      result.criticalStatus,
    ]);
    this.events.emit('status.updated', {
      studentId: dto.studentId,
      oldColor,
      newColor,
      color: newColor,
      changedBy: actor.userId,
      tenantId: actor.tenantId,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Manager / filadmin sets the CRITICAL status colour for a student.
   * Sariq / qizil emit an extra `notification.new` event to the filadmin.
   */
  async setCriticalStatus(actor: ActorContext, dto: SetCriticalStatusDto) {
    const dateObj = dto.date ? new Date(dto.date) : startOfToday();

    const existing = await this.prisma.studentStatus.findUnique({
      where: { studentId_date: { studentId: dto.studentId, date: dateObj } },
    });
    const oldColor = existing
      ? this.worstColor([
          existing.englishStatus,
          existing.personalStatus,
          existing.criticalStatus,
        ])
      : null;

    const result = await this.prisma.studentStatus.upsert({
      where: { studentId_date: { studentId: dto.studentId, date: dateObj } },
      create: {
        studentId: dto.studentId,
        date: dateObj,
        criticalStatus: dto.color,
        criticalNote: dto.note,
      },
      update: {
        criticalStatus: dto.color,
        criticalNote: dto.note,
      },
    });

    const newColor = this.worstColor([
      result.englishStatus,
      result.personalStatus,
      result.criticalStatus,
    ]);
    this.events.emit('status.updated', {
      studentId: dto.studentId,
      oldColor,
      newColor,
      color: newColor,
      changedBy: actor.userId,
      tenantId: actor.tenantId,
      timestamp: new Date().toISOString(),
    });

    if (dto.color === 'sariq' || dto.color === 'qizil') {
      const filadmin = await this.findFiladmin(actor.tenantId);
      if (filadmin) {
        this.events.emit('notification.new', {
          userId: filadmin.id,
          tenantId: actor.tenantId,
          type: 'status.critical_escalation',
          message:
            dto.color === 'qizil'
              ? "O'quvchi qizil holatga tushdi"
              : "O'quvchi sariq holatga tushdi",
          studentId: dto.studentId,
          color: dto.color,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return result;
  }

  private async findBranchManager(
    studentId: string,
  ): Promise<{ id: string } | null> {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { branchId: true, tenantId: true },
    });
    if (!student?.branchId) return null;
    return this.prisma.user.findFirst({
      where: {
        tenantId: student.tenantId,
        branchId: student.branchId,
        role: UserRole.manager,
        status: 'active',
      },
      select: { id: true },
    });
  }

  private findFiladmin(tenantId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        role: UserRole.filadmin,
        status: 'active',
      },
      select: { id: true },
    });
  }

  private worstColor(values: (string | null | undefined)[]): string | null {
    const order: Record<string, number> = { qizil: 3, sariq: 2, yashil: 1 };
    let best: string | null = null;
    let bestRank = 0;
    for (const v of values) {
      if (!v) continue;
      const rank = order[v] ?? 0;
      if (rank > bestRank) {
        bestRank = rank;
        best = v;
      }
    }
    return best;
  }

  async getLatest(studentId: string) {
    return this.prisma.studentStatus.findFirst({
      where: { studentId },
      orderBy: { date: 'desc' },
    });
  }

  async getHistory(studentId: string, limit = 30) {
    return this.prisma.studentStatus.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getRedStudents(tenantId: string) {
    return this.getStudentsByColor(tenantId, 'qizil');
  }

  async getYellowStudents(tenantId: string) {
    return this.getStudentsByColor(tenantId, 'sariq');
  }

  private getStudentsByColor(tenantId: string, color: string) {
    return this.prisma.studentStatus.findMany({
      where: {
        student: { tenantId },
        OR: [
          { englishStatus: color },
          { personalStatus: color },
          { criticalStatus: color },
        ],
      },
      orderBy: { date: 'desc' },
      distinct: ['studentId'],
      include: {
        student: { select: { id: true, name: true } },
      },
    });
  }

  async getHighPerformers(tenantId: string, branchId?: string | null) {
    const totalLessons = await this.prisma.lesson.count({
      where: { tenantId, isPublished: true },
    });
    if (totalLessons === 0) return [];
    const threshold = Math.floor(totalLessons * 0.9);

    const students = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: 'student',
        status: 'active',
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        name: true,
        studentStatuses: {
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            englishStatus: true,
            personalStatus: true,
            criticalStatus: true,
          },
        },
        studentProgress: {
          where: { academyCompleted: true },
          select: { id: true },
        },
      },
    });

    return students
      .filter((s) => {
        const status = s.studentStatuses[0];
        if (!status) return false;
        const allGreen =
          status.englishStatus === 'yashil' &&
          status.personalStatus === 'yashil' &&
          status.criticalStatus === 'yashil';
        const progressOk = s.studentProgress.length >= threshold;
        return allGreen && progressOk;
      })
      .map((s) => ({
        id: s.id,
        name: s.name,
        lessonsCompleted: s.studentProgress.length,
        totalLessons,
      }));
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
