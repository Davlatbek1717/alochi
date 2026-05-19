import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KpiService, KPI_POINTS, KPI_REASONS } from '../kpi/kpi.service';
import { SetPersonalStatusDto } from './dto/set-personal-status.dto';
import { SetCriticalStatusDto } from './dto/set-critical-status.dto';
import { StatusColor, worstStatusColor } from './status.types';

interface ActorContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}

interface SetEnglishStatusMeta {
  /** Free-form audit tag (e.g. 'ai_evaluation'). Logged on the event. */
  source?: string;
  lessonId?: string;
  score?: number;
  /** Optional override for the actor that triggered the change. */
  changedBy?: string;
}

@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private kpi: KpiService,
  ) {}

  /**
   * Mentor sets the PERSONAL status colour for a student.
   *
   * Auto-green logic (product rule, 2026-05):
   *   if new personalStatus === 'yashil'
   *   AND prior criticalStatus !== 'yashil'
   *   → criticalStatus is auto-set to 'yashil' and a notification is
   *     emitted to the student's branch manager.
   *
   * Earlier this rule also required today's englishStatus to be
   * 'yashil', but the product owner inverted it: a strong personal-
   * development signal alone is now sufficient to clear the
   * critical-status flag, since mentor evaluation is the most
   * trustworthy holistic read on the student.
   */
  async setPersonalStatus(actor: ActorContext, dto: SetPersonalStatusDto) {
    // Daily personal-development status: one row per student per day
    // (StudentStatus @@unique([studentId, date])). A mentor may only
    // set it for students in their OWN group.
    const mentor = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { groupId: true },
    });
    if (!mentor?.groupId) {
      throw new ForbiddenException(
        "Sizga guruh biriktirilmagan — holat belgilab bo'lmaydi",
      );
    }
    const student = await this.prisma.user.findUnique({
      where: { id: dto.studentId },
      select: { groupId: true, role: true },
    });
    if (
      !student ||
      student.role !== UserRole.student ||
      student.groupId !== mentor.groupId
    ) {
      throw new ForbiddenException(
        "Faqat o'z guruhingiz o'quvchisi holatini belgilay olasiz",
      );
    }

    const dateObj = dto.date ? new Date(dto.date) : startOfToday();

    const existing = await this.prisma.studentStatus.findUnique({
      where: { studentId_date: { studentId: dto.studentId, date: dateObj } },
    });

    const previousCritical = existing?.criticalStatus ?? null;
    const oldColor = existing
      ? worstStatusColor([
          existing.englishStatus,
          existing.personalStatus,
          existing.criticalStatus,
        ])
      : null;

    const autoGreen = dto.color === 'yashil' && previousCritical !== 'yashil';

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

    const newColor = worstStatusColor([
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
    const previousCritical = existing?.criticalStatus ?? null;
    const oldColor = existing
      ? worstStatusColor([
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

    const newColor = worstStatusColor([
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

    // Spec §8.2: branch manager earns KPI for *improving* a student's
    // critical status colour (qizil→sariq=+10, sariq→yashil=+15). No
    // penalty for backward transitions; no bonus for first-time critical.
    await this.awardManagerOnImprovement(
      actor,
      dto.studentId,
      previousCritical,
      dto.color,
    );

    return result;
  }

  /**
   * Award the branch manager KPI when a student's critical status
   * improves. Errors here are logged but never bubble up — KPI awards
   * must never block a status transition.
   */
  private async awardManagerOnImprovement(
    actor: ActorContext,
    studentId: string,
    prev: string | null,
    next: string,
  ): Promise<void> {
    if (!prev) return;

    let amount = 0;
    let reason: string | null = null;
    if (prev === 'qizil' && next === 'sariq') {
      amount = KPI_POINTS.MANAGER_RED_TO_YELLOW;
      reason = KPI_REASONS.CRITICAL_RED_TO_YELLOW;
    } else if (prev === 'sariq' && next === 'yashil') {
      amount = KPI_POINTS.MANAGER_YELLOW_TO_GREEN;
      reason = KPI_REASONS.CRITICAL_YELLOW_TO_GREEN;
    }
    if (!reason) return;

    try {
      const manager = await this.findBranchManager(studentId);
      if (!manager) return;
      await this.kpi.award({
        tenantId: actor.tenantId,
        userId: manager.id,
        score: amount,
        reason,
      });
    } catch (err) {
      this.logger.warn(
        `KPI award (${reason}) failed for student=${studentId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * AI- (or system-) driven setter for the ENGLISH status colour.
   *
   * Used after a Claude evaluation finalises a lesson — the mapped colour
   * (>=80 yashil / >=50 sariq / <50 qizil) is persisted on today's row,
   * and the auto-yellow rule is re-evaluated from this side too:
   * when englishStatus flips to `yashil` AND personalStatus is also
   * `yashil` AND prior criticalStatus !== `yashil`, criticalStatus is
   * auto-flipped to `yashil` and a notification fires to the branch
   * manager.
   *
   * Tenant comes from the student's row (this is a system call, no
   * authenticated actor).
   */
  async setEnglishStatus(
    studentId: string,
    color: StatusColor,
    meta: SetEnglishStatusMeta = {},
  ) {
    const dateObj = startOfToday();
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { tenantId: true, branchId: true },
    });
    if (!student) {
      // Caller (AI evaluation) gave a bad id — silently skip rather than
      // explode the lesson-completion path.
      return null;
    }

    const existing = await this.prisma.studentStatus.findUnique({
      where: { studentId_date: { studentId, date: dateObj } },
    });

    const personalToday = existing?.personalStatus ?? null;
    const previousCritical = existing?.criticalStatus ?? null;
    const oldColor = existing
      ? worstStatusColor([
          existing.englishStatus,
          existing.personalStatus,
          existing.criticalStatus,
        ])
      : null;

    const autoGreen =
      color === 'yashil' &&
      personalToday === 'yashil' &&
      previousCritical !== 'yashil';

    const result = await this.prisma.studentStatus.upsert({
      where: { studentId_date: { studentId, date: dateObj } },
      create: {
        studentId,
        date: dateObj,
        englishStatus: color,
        ...(autoGreen ? { criticalStatus: 'yashil' } : {}),
      },
      update: {
        englishStatus: color,
        ...(autoGreen ? { criticalStatus: 'yashil' } : {}),
      },
    });

    if (autoGreen) {
      const manager = await this.findBranchManager(studentId);
      if (manager) {
        this.events.emit('notification.new', {
          userId: manager.id,
          tenantId: student.tenantId,
          type: 'status.auto_green',
          message: "Sardor o'quvchining holati yashilga tushdi (avtomatik)",
          studentId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const newColor = worstStatusColor([
      result.englishStatus,
      result.personalStatus,
      result.criticalStatus,
    ]);
    this.events.emit('status.updated', {
      studentId,
      oldColor,
      newColor,
      color: newColor,
      changedBy: meta.changedBy ?? 'system',
      tenantId: student.tenantId,
      source: meta.source,
      lessonId: meta.lessonId,
      score: meta.score,
      timestamp: new Date().toISOString(),
    });

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

  /**
   * Aggregate counts of latest critical-status colours for active students.
   * Used by filadmin & manager dashboards.
   */
  async getStatusSummary(
    tenantId: string,
    branchId?: string,
  ): Promise<{ yashil: number; sariq: number; qizil: number }> {
    const students = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: 'student',
        status: 'active',
        ...(branchId ? { branchId } : {}),
      },
      select: {
        studentStatuses: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { criticalStatus: true },
        },
      },
    });
    let yashil = 0;
    let sariq = 0;
    let qizil = 0;
    for (const s of students) {
      const c = s.studentStatuses[0]?.criticalStatus;
      if (c === 'yashil') yashil++;
      else if (c === 'sariq') sariq++;
      else if (c === 'qizil') qizil++;
    }
    return { yashil, sariq, qizil };
  }

  async getRedStudents(tenantId: string) {
    return this.getStudentsByColor(tenantId, 'qizil');
  }

  async getYellowStudents(tenantId: string) {
    return this.getStudentsByColor(tenantId, 'sariq');
  }

  private getStudentsByColor(tenantId: string, color: StatusColor) {
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
