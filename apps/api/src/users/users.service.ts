import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface BlockStatusResult {
  isBlocked: boolean;
  reason: 'warning' | 'payment' | null;
  blockedAt: Date | null;
  unblockAt: Date | null;
}

// Valid user status transitions. All others are rejected.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  active: ['blocked_warning', 'blocked_payment', 'inactive'],
  blocked_warning: ['active', 'blocked_payment', 'inactive'],
  blocked_payment: ['active', 'inactive'],
  inactive: ['active'],
};

export function canTransitionStatus(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private i18n: I18nService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor?: { userId: string; delegationId?: string | null },
  ) {
    // The controller guarantees tenantId is set from the JWT before calling
    // us, but the DTO type marks it optional so single-tenant clients can
    // omit it from the request body. Re-narrow here.
    if (!dto.tenantId) {
      throw new ConflictException(this.i18n.t('duplicate_login'));
    }
    const tenantId = dto.tenantId;

    const exists = await this.prisma.user.findFirst({
      where: { tenantId, login: dto.login },
    });
    if (exists) throw new ConflictException(this.i18n.t('duplicate_login'));

    const { password, joinedAt, steps, warnings, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        tenantId,
        passwordHash,
        ...(joinedAt !== undefined ? { joinedAt: new Date(joinedAt) } : {}),
        ...(steps !== undefined
          ? { steps: steps as Prisma.InputJsonValue }
          : {}),
        ...(warnings !== undefined
          ? { warnings: warnings as Prisma.InputJsonValue }
          : {}),
      },
    });

    // Auto-friendship: when a student joins a group, accept-link them with
    // every existing same-group student in O(N) bulk inserts.
    if (dto.role === UserRole.student && dto.groupId) {
      await this.autoFriendGroupmates(user.id, dto.groupId).catch(
        () => undefined,
      );
    }

    // Audit-log staff creation when actor was acting under a delegation.
    const isStaffRole = dto.role !== UserRole.student;
    if (actor?.delegationId && isStaffRole) {
      await this.prisma.delegationAuditLog.create({
        data: {
          delegationId: actor.delegationId,
          actorId: actor.userId,
          actionType: 'staff_added',
          targetId: user.id,
          meta: { role: dto.role, login: dto.login, name: dto.name },
        },
      });
    }

    return user;
  }

  async findByBranch(branchId: string, tenantId: string) {
    return this.prisma.user.findMany({
      where: { branchId, tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        login: true,
        firstName: true,
        lastName: true,
        region: true,
        school: true,
        district: true,
        grade: true,
        percentage: true,
        isPaid: true,
        totalPoints: true,
        joinedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Group-scoped roster. Returns active users whose `groupId` matches and
   * whose tenant matches the caller's tenant. Used by mentor frontend
   * (`/users/group/:groupId`).
   */
  async findByGroup(groupId: string, tenantId: string) {
    return this.prisma.user.findMany({
      where: { groupId, tenantId, status: 'active' },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        login: true,
        branchId: true,
        groupId: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        branchId: true,
        groupId: true,
        phone: true,
        login: true,
        firstName: true,
        lastName: true,
        region: true,
        school: true,
        district: true,
        grade: true,
        steps: true,
        percentage: true,
        isPaid: true,
        blockedReason: true,
        totalPoints: true,
        joinedAt: true,
        crmStudentId: true,
        avatarUrl: true,
        birthDate: true,
        parentTelegramId: true,
        timeSlot: true,
        warnings: true,
        warningsCount: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException(this.i18n.t('user_not_found'));
    return user;
  }

  /**
   * 25.C.2: Blocked students list. `reason` is one of `warning|payment` (or
   * undefined for both). `branchId` filter is required for non-superadmin.
   */
  async findBlocked(
    tenantId: string,
    opts?: { reason?: 'warning' | 'payment'; branchId?: string },
  ) {
    const statuses: ('blocked_warning' | 'blocked_payment')[] =
      opts?.reason === 'warning'
        ? ['blocked_warning']
        : opts?.reason === 'payment'
          ? ['blocked_payment']
          : ['blocked_warning', 'blocked_payment'];

    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: UserRole.student,
        status: { in: statuses },
        ...(opts?.branchId ? { branchId: opts.branchId } : {}),
      },
      select: {
        id: true,
        name: true,
        login: true,
        status: true,
        branchId: true,
        phone: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * 25.F.1: Average pass-rate of all students in a group across all attempts.
   * Returns 0 when no progress recorded.
   */
  async getGroupAvgPassRate(groupId: string, tenantId: string) {
    const students = await this.prisma.user.findMany({
      where: { groupId, tenantId, role: UserRole.student },
      select: { id: true },
    });
    if (students.length === 0) return { groupId, avgPassRate: 0, sample: 0 };

    const studentIds = students.map((s) => s.id);
    const progress = await this.prisma.studentProgress.findMany({
      where: { studentId: { in: studentIds } },
      select: { academyCompleted: true },
    });
    if (progress.length === 0) return { groupId, avgPassRate: 0, sample: 0 };

    const passed = progress.filter((p) => p.academyCompleted).length;
    return {
      groupId,
      avgPassRate: Math.round((passed / progress.length) * 100),
      sample: progress.length,
    };
  }

  async findAll(
    tenantId: string,
    branchId?: string,
    role?: UserRole,
    caller?: { role: UserRole; branchId: string | null },
  ) {
    // Manager and tester callers are pinned to their own branch
    // regardless of query — both roles only ever need their own
    // branch's students, and forcing the scope here prevents snooping
    // by hand-crafting branchId in the query string.
    const branchScopedRoles: UserRole[] = [UserRole.manager, UserRole.tester];
    const effectiveBranchId =
      caller && branchScopedRoles.includes(caller.role)
        ? (caller.branchId ?? '__no_branch__')
        : branchId;

    return this.prisma.user.findMany({
      where: {
        tenantId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(role ? { role } : {}),
      },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        login: true,
        branchId: true,
        firstName: true,
        lastName: true,
        region: true,
        school: true,
        district: true,
        grade: true,
        percentage: true,
        isPaid: true,
        totalPoints: true,
        joinedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      phone?: string;
      branchId?: string;
      role?: UserRole;
      groupId?: string | null;
      region?: string | null;
      school?: string | null;
      avatarUrl?: string | null;
      parentTelegramId?: string | null;
      birthDate?: string | null;
      firstName?: string;
      lastName?: string;
      district?: string;
      grade?: number;
      steps?: unknown;
      percentage?: number;
      isPaid?: boolean;
      blockedReason?: string;
      joinedAt?: string | null;
      totalPoints?: number;
      timeSlot?: string;
      warnings?: unknown;
      warningsCount?: number;
    },
  ) {
    const before = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, role: true, groupId: true },
    });
    if (!before) throw new NotFoundException(this.i18n.t('user_not_found'));

    // birthDate / joinedAt arrive as ISO date strings; Prisma needs Date
    // objects for the underlying timestamp columns. Pass undefined when
    // the field wasn't sent so we don't accidentally clear it.
    const { birthDate, joinedAt, steps, warnings, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (birthDate !== undefined) {
      updateData.birthDate = birthDate ? new Date(birthDate) : null;
    }
    if (joinedAt !== undefined) {
      updateData.joinedAt = joinedAt ? new Date(joinedAt) : null;
    }
    if (steps !== undefined) {
      updateData.steps = steps as Prisma.InputJsonValue;
    }
    if (warnings !== undefined) {
      updateData.warnings = warnings as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Auto-friendship on group join (null → set, or change to a new group)
    const newGroupId = data.groupId ?? null;
    if (
      updated.role === UserRole.student &&
      newGroupId &&
      newGroupId !== before.groupId
    ) {
      await this.autoFriendGroupmates(id, newGroupId).catch(() => undefined);
    }

    return updated;
  }

  /**
   * Bulk-create accepted Friendship rows (scope=group) between `userId` and
   * every existing same-group student. Uses `skipDuplicates` to safely
   * tolerate re-runs.
   */
  private async autoFriendGroupmates(userId: string, groupId: string) {
    const groupmates = await this.prisma.user.findMany({
      where: {
        groupId,
        role: UserRole.student,
        id: { not: userId },
        status: 'active',
      },
      select: { id: true },
    });
    if (groupmates.length === 0) return;

    await this.prisma.friendship.createMany({
      data: groupmates.map((g) => ({
        userId,
        friendId: g.id,
        scope: 'group' as const,
        status: 'accepted',
      })),
      skipDuplicates: true,
    });
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: 'active' | 'inactive',
    changedBy?: string,
    reason?: string,
  ) {
    const user = await this.findById(id, tenantId);
    const from = user.status as string;
    if (from !== status && !canTransitionStatus(from, status)) {
      throw new BadRequestException(
        `Status transition ${from} → ${status} ruxsat etilmagan`,
      );
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { status } });
    await this.prisma.userStatusHistory.create({
      data: { userId: id, fromStatus: from, toStatus: status, changedBy, reason },
    });
    return updated;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        tenantId: true,
        branchId: true,
        groupId: true,
        parentTelegramId: true,
        telegramId: true,
        birthDate: true,
        faceEmbeddings: { where: { isActive: true }, select: { id: true } },
        branch: { select: { id: true, name: true } },
        // group via groupId — users table stores groupId but no direct group relation
      },
    });
    return {
      id: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      groupId: user.groupId,
      faceEnrolled: user.faceEmbeddings.length > 0,
      parentTelegramLinked: user.parentTelegramId !== null,
      parentTelegramId: user.parentTelegramId,
      // Expose whether the student has linked their own Telegram (for video check-in)
      telegramLinked: user.telegramId !== null,
      telegramId: user.telegramId?.toString() ?? null,
      birthDate: user.birthDate?.toISOString() ?? null,
      branch: user.branch,
    };
  }

  /**
   * Derived block-status:
   *   isBlocked = user.status ∈ {blocked_warning, blocked_payment}
   *   reason    = 'warning' | 'payment'
   *   blockedAt = newest active warning.createdAt (warning) OR null (payment, no source)
   *   unblockAt = soonest payment.unblockAt for the student (payment) OR null
   */
  async getBlockStatus(
    id: string,
    tenantId: string,
  ): Promise<BlockStatusResult> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException(this.i18n.t('user_not_found'));

    const isBlocked =
      user.status === 'blocked_warning' || user.status === 'blocked_payment';
    if (!isBlocked) {
      return {
        isBlocked: false,
        reason: null,
        blockedAt: null,
        unblockAt: null,
      };
    }

    if (user.status === 'blocked_warning') {
      const latestWarning = await this.prisma.warning.findFirst({
        where: { studentId: id, isCancelled: false },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      return {
        isBlocked: true,
        reason: 'warning',
        blockedAt: latestWarning?.createdAt ?? null,
        unblockAt: null,
      };
    }

    // blocked_payment
    const nextUnblock = await this.prisma.payment.findFirst({
      where: { studentId: id, unblockAt: { gt: new Date() } },
      orderBy: { unblockAt: 'asc' },
      select: { unblockAt: true, paidAt: true },
    });
    return {
      isBlocked: true,
      reason: 'payment',
      blockedAt: nextUnblock?.paidAt ?? null,
      unblockAt: nextUnblock?.unblockAt ?? null,
    };
  }

  /**
   * Reset a user's password (superadmin/filadmin).
   * Returns nothing — the caller should communicate the new password via
   * a separate channel.
   */
  async resetPassword(id: string, tenantId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new ConflictException(
        'Parol kamida 6 ta belgidan iborat bo‘lishi kerak',
      );
    }
    await this.findById(id, tenantId);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  /**
   * Hard-delete a user. Cleans up child rows whose foreign keys do NOT
   * already specify `ON DELETE CASCADE` in the schema, then deletes the
   * `users` row. Wrapped in a single transaction so a partial failure
   * leaves the database untouched.
   *
   * Cascading-by-schema (no manual cleanup needed): refresh_tokens,
   * exam_permissions, social_feed_events, feed_event_reactions, tasks,
   * spaced_repetition, error_logs, tournament_registrations,
   * lesson_feedbacks, student_variant_assignments,
   * culture_lesson_attendance, student_letters, promotion_reports,
   * manager_sessions, kpi_override_log (student side; actor side is
   * SetNull), video_checkins, staff_video_guides (creator SetNull),
   * notifications, message_reactions, duel_answers, chat_bans.
   */
  async remove(id: string, tenantId: string) {
    // Validate the user exists and belongs to the caller's tenant.
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, role: true, login: true },
    });
    if (!user) throw new NotFoundException(this.i18n.t('user_not_found'));

    await this.prisma.$transaction(async (tx) => {
      // Student-only profile rows (no cascade in schema).
      await tx.studentProgress.deleteMany({ where: { studentId: id } });
      await tx.studentLessonConfig.deleteMany({
        where: { OR: [{ studentId: id }, { changedBy: id }] },
      });
      await tx.studentStatus.deleteMany({ where: { studentId: id } });
      await tx.attendanceStudent.deleteMany({ where: { studentId: id } });
      await tx.warning.deleteMany({ where: { studentId: id } });
      await tx.payment.deleteMany({ where: { studentId: id } });
      await tx.studentStreak.deleteMany({ where: { studentId: id } });
      await tx.dailyQuest.deleteMany({ where: { studentId: id } });
      await tx.certificate.deleteMany({ where: { studentId: id } });

      // Staff/general rows (no cascade in schema).
      await tx.attendanceStaff.deleteMany({ where: { userId: id } });
      await tx.kpiScore.deleteMany({ where: { userId: id } });
      await tx.faceEmbedding.deleteMany({ where: { userId: id } });
      // Face recognition log keeps the row but null out the matched user.
      await tx.faceRecognitionLog.updateMany({
        where: { matchedUserId: id },
        data: { matchedUserId: null },
      });

      // Social graph (both directions).
      await tx.friendship.deleteMany({
        where: { OR: [{ userId: id }, { friendId: id }] },
      });
      await tx.duel.deleteMany({
        where: { OR: [{ challengerId: id }, { challengedId: id }] },
      });
      await tx.groupMessage.deleteMany({ where: { senderId: id } });

      // Delegations (both directions).
      await tx.delegation.deleteMany({
        where: { OR: [{ fromUserId: id }, { toUserId: id }] },
      });

      // Finally drop the user. Remaining cascading FKs unwind on their own.
      await tx.user.delete({ where: { id } });
    });

    this.events.emit('user.deleted', {
      userId: id,
      role: user.role,
      login: user.login,
      tenantId,
      timestamp: new Date().toISOString(),
    });

    return { ok: true, id };
  }

  /**
   * Manually unblock a student (superadmin/filadmin).
   * Sets status back to 'active' and emits `student.unblocked`.
   */
  async unblock(
    id: string,
    tenantId: string,
    actorId: string,
    reason?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException(this.i18n.t('user_not_found'));

    if (
      user.status !== 'blocked_warning' &&
      user.status !== 'blocked_payment'
    ) {
      // No-op for already-active users; still return the user
      return this.prisma.user.findUniqueOrThrow({ where: { id } });
    }

    const fromStatus = user.status;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: 'active' },
    });
    await this.prisma.userStatusHistory.create({
      data: {
        userId: id,
        fromStatus,
        toStatus: 'active',
        changedBy: actorId,
        reason: reason ?? 'manual_unblock',
      },
    });

    this.events.emit('student.unblocked', {
      studentId: id,
      by: actorId,
      reason: reason ?? null,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }
}
