import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateGuideDto {
  tenantId: string;
  title: string;
  role: string;
  videoUrl: string;
  order?: number;
  createdBy: string;
}

interface UpdateGuideDto {
  title?: string;
  role?: string;
  videoUrl?: string;
  order?: number;
}

@Injectable()
export class StaffGuidesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, role?: string) {
    return this.prisma.staffVideoGuide.findMany({
      where: { tenantId, ...(role ? { role } : {}) },
      orderBy: [{ role: 'asc' }, { order: 'asc' }],
    });
  }

  async create(dto: CreateGuideDto) {
    return this.prisma.staffVideoGuide.create({
      data: {
        tenantId: dto.tenantId,
        title: dto.title,
        role: dto.role,
        videoUrl: dto.videoUrl,
        order: dto.order ?? 0,
        createdBy: dto.createdBy,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateGuideDto) {
    const existing = await this.prisma.staffVideoGuide.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Qollanma topilmadi');
    return this.prisma.staffVideoGuide.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.staffVideoGuide.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Qollanma topilmadi');
    return this.prisma.staffVideoGuide.delete({ where: { id } });
  }
}
