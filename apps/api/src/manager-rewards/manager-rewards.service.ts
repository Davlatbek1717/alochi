import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateRewardInput {
  tenantId: string;
  branchId: string;
  managerId: string;
  studentId: string;
  type: string;
  title: string;
  description?: string;
}

@Injectable()
export class ManagerRewardsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateRewardInput) {
    return this.prisma.managerReward.create({ data });
  }

  /**
   * List rewards for a tenant. When `branchId` is provided we scope to it;
   * otherwise (e.g. superadmin caller without a branch) we return all
   * rewards for the tenant.
   */
  async listForBranch(tenantId: string, branchId?: string | null) {
    return this.prisma.managerReward.findMany({
      where: branchId ? { tenantId, branchId } : { tenantId },
      orderBy: { givenAt: 'desc' },
    });
  }

  async listForStudent(studentId: string) {
    return this.prisma.managerReward.findMany({
      where: { studentId },
      orderBy: { givenAt: 'desc' },
    });
  }

  async update(
    id: string,
    actor: { userId: string; tenantId: string },
    patch: { type?: string; title?: string; description?: string | null },
  ) {
    const existing = await this.prisma.managerReward.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing) throw new NotFoundException('Sovgʻa topilmadi');
    if (existing.managerId !== actor.userId) {
      throw new ForbiddenException('Faqat bergan menejer tahrirlay oladi');
    }
    const data: { type?: string; title?: string; description?: string | null } =
      {};
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    return this.prisma.managerReward.update({ where: { id }, data });
  }

  async remove(id: string, actor: { userId: string; tenantId: string }) {
    const existing = await this.prisma.managerReward.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!existing) throw new NotFoundException('Sovgʻa topilmadi');
    if (existing.managerId !== actor.userId) {
      throw new ForbiddenException('Faqat bergan menejer o‘chira oladi');
    }
    await this.prisma.managerReward.delete({ where: { id } });
    return { ok: true };
  }
}
