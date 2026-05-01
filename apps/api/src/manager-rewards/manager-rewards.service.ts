import { Injectable } from '@nestjs/common';
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
}
