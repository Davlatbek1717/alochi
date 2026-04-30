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

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findFirst({
      where: { tenantId: dto.tenantId, login: dto.login },
    });
    if (exists) throw new ConflictException('Bu login allaqachon mavjud');

    const { password, ...data } = dto;
    const passwordHash = await bcrypt.hash(password, 12);

    return this.prisma.user.create({ data: { ...data, passwordHash } });
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

  async findAll(tenantId: string, branchId?: string, role?: UserRole) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
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
    data: { name?: string; phone?: string; branchId?: string; role?: UserRole },
  ) {
    await this.findById(id, tenantId);
    return this.prisma.user.update({ where: { id }, data });
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
