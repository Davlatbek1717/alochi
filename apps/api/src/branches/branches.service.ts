import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: { name: string }) {
    return this.prisma.branch.create({
      data: { tenantId, name: data.name },
    });
  }

  async findByTenant(tenantId: string) {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    return branches.map((b) => ({
      id: b.id,
      tenantId: b.tenantId,
      name: b.name,
      filadminId: b.filadminId,
      workStartTime: b.workStartTime,
      lateGraceMinutes: b.lateGraceMinutes,
      chatLocked: b.chatLocked,
      userCount: b._count.users,
    }));
  }

  async findById(id: string, tenantId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
    });
    if (!branch) throw new NotFoundException('Filial topilmadi');
    return branch;
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      workStartTime?: string;
      lateGraceMinutes?: number;
      chatLocked?: boolean;
    },
  ) {
    await this.findById(id, tenantId);
    const patch: {
      name?: string;
      workStartTime?: string;
      lateGraceMinutes?: number;
      chatLocked?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.workStartTime !== undefined)
      patch.workStartTime = data.workStartTime;
    if (data.lateGraceMinutes !== undefined)
      patch.lateGraceMinutes = data.lateGraceMinutes;
    if (data.chatLocked !== undefined) patch.chatLocked = data.chatLocked;
    return this.prisma.branch.update({ where: { id }, data: patch });
  }

  /**
   * Delete a branch. Only allowed when no users are attached. Throws
   * `ConflictException` otherwise so the frontend can surface a meaningful
   * error.
   */
  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    const userCount = await this.prisma.user.count({ where: { branchId: id } });
    if (userCount > 0) {
      throw new ConflictException(
        `Filialda ${userCount} foydalanuvchi mavjud. Avval ularni boshqa filialga ko'chiring.`,
      );
    }
    return this.prisma.branch.delete({ where: { id } });
  }

  async assignFiladmin(branchId: string, filadminId: string, tenantId: string) {
    await this.findById(branchId, tenantId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data: { filadminId },
    });
  }

  /**
   * 25.C.1: Branch statistics — student counts, staff counts, blocked counts.
   */
  async getStats(branchId: string, tenantId: string) {
    await this.findById(branchId, tenantId);

    const [
      totalStudents,
      activeStudents,
      blockedWarning,
      blockedPayment,
      mentors,
      managers,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { branchId, role: 'student' },
      }),
      this.prisma.user.count({
        where: { branchId, role: 'student', status: 'active' },
      }),
      this.prisma.user.count({
        where: { branchId, role: 'student', status: 'blocked_warning' },
      }),
      this.prisma.user.count({
        where: { branchId, role: 'student', status: 'blocked_payment' },
      }),
      this.prisma.user.count({ where: { branchId, role: 'mentor' } }),
      this.prisma.user.count({ where: { branchId, role: 'manager' } }),
    ]);

    return {
      branchId,
      students: {
        total: totalStudents,
        active: activeStudents,
        blockedWarning,
        blockedPayment,
      },
      staff: { mentors, managers },
    };
  }
}
