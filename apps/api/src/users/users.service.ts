import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface BlockStatusResult {
  isBlocked: boolean;
  reason: 'warning' | 'payment' | null;
  blockedAt: Date | null;
  unblockAt: Date | null;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async create(
    dto: CreateUserDto,
    actor?: { userId: string; delegationId?: string | null },
  ) {
    const exists = await this.prisma.user.findFirst({
      where: { tenantId: dto.tenantId, login: dto.login },
    });
    if (exists) throw new ConflictException('Bu login allaqachon mavjud');

    const { password, ...data } = dto;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: { ...data, passwordHash },
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
        phone: true,
        login: true,
      },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
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
    // Manager callers are scoped to their own branch regardless of query.
    const effectiveBranchId =
      caller?.role === UserRole.manager
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
    },
  ) {
    const before = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, role: true, groupId: true },
    });
    if (!before) throw new NotFoundException('Foydalanuvchi topilmadi');

    const updated = await this.prisma.user.update({ where: { id }, data });

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
  ) {
    await this.findById(id, tenantId);
    return this.prisma.user.update({ where: { id }, data: { status } });
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
        parentTelegramId: true,
        faceEmbeddings: { where: { isActive: true }, select: { id: true } },
      },
    });
    return {
      id: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      tenantId: user.tenantId,
      faceEnrolled: user.faceEmbeddings.length > 0,
      parentTelegramLinked: user.parentTelegramId !== null,
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
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

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
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (
      user.status !== 'blocked_warning' &&
      user.status !== 'blocked_payment'
    ) {
      // No-op for already-active users; still return the user
      return this.prisma.user.findUniqueOrThrow({ where: { id } });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: 'active' },
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
