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

  async listForBranch(tenantId: string, branchId: string) {
    return this.prisma.managerReward.findMany({
      where: { tenantId, branchId },
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
