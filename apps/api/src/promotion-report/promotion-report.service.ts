import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateDto {
  filadminId: string;
  branchId: string;
  schoolName: string;
  studentsReached: number;
  visitDate: string;
  notes?: string;
}

@Injectable()
export class PromotionReportService {
  constructor(private prisma: PrismaService) {}

  async list(filadminId: string) {
    return this.prisma.promotionReport.findMany({
      where: { filadminId },
      orderBy: { visitDate: 'desc' },
      take: 100,
    });
  }

  async listByBranch(branchId: string) {
    return this.prisma.promotionReport.findMany({
      where: { branchId },
      orderBy: { visitDate: 'desc' },
      take: 100,
    });
  }

  async create(dto: CreateDto) {
    return this.prisma.promotionReport.create({
      data: {
        filadminId: dto.filadminId,
        branchId: dto.branchId,
        schoolName: dto.schoolName,
        studentsReached: dto.studentsReached,
        visitDate: new Date(dto.visitDate),
        notes: dto.notes,
      },
    });
  }
}
