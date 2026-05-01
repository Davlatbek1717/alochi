import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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

  async update(
    id: string,
    callerId: string,
    patch: {
      schoolName?: string;
      studentsReached?: number;
      visitDate?: string;
      notes?: string | null;
    },
  ) {
    const existing = await this.prisma.promotionReport.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Hisobot topilmadi');
    if (existing.filadminId !== callerId)
      throw new ForbiddenException('Faqat yaratuvchi tahrirlay oladi');
    const data: {
      schoolName?: string;
      studentsReached?: number;
      visitDate?: Date;
      notes?: string | null;
    } = {};
    if (patch.schoolName !== undefined) data.schoolName = patch.schoolName;
    if (patch.studentsReached !== undefined)
      data.studentsReached = patch.studentsReached;
    if (patch.visitDate !== undefined)
      data.visitDate = new Date(patch.visitDate);
    if (patch.notes !== undefined) data.notes = patch.notes;
    return this.prisma.promotionReport.update({ where: { id }, data });
  }

  async remove(id: string, callerId: string) {
    const existing = await this.prisma.promotionReport.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Hisobot topilmadi');
    if (existing.filadminId !== callerId)
      throw new ForbiddenException('Faqat yaratuvchi o‘chira oladi');
    await this.prisma.promotionReport.delete({ where: { id } });
    return { ok: true };
  }
}
