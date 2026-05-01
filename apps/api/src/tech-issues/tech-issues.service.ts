import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateInput {
  tenantId: string;
  branchId?: string | null;
  reportedBy: string;
  category: string;
  description: string;
  severity?: string;
}

@Injectable()
export class TechIssuesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateInput) {
    return this.prisma.techIssue.create({
      data: {
        tenantId: data.tenantId,
        branchId: data.branchId ?? null,
        reportedBy: data.reportedBy,
        category: data.category,
        description: data.description,
        severity: data.severity ?? 'medium',
      },
    });
  }

  async list(tenantId: string, opts?: { status?: string }) {
    return this.prisma.techIssue.findMany({
      where: { tenantId, ...(opts?.status ? { status: opts.status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: string, resolution: string) {
    return this.prisma.techIssue.update({
      where: { id },
      data: {
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
      },
    });
  }
}
