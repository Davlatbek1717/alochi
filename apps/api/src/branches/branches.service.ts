import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!branch) throw new NotFoundException('Filial topilmadi');
    return branch;
  }

  async update(id: string, tenantId: string, data: { name?: string }) {
    await this.findById(id, tenantId);
    return this.prisma.branch.update({ where: { id }, data });
  }

  async assignFiladmin(branchId: string, filadminId: string, tenantId: string) {
    await this.findById(branchId, tenantId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data: { filadminId },
    });
  }
}
