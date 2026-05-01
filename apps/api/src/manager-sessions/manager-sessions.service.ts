import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateDto {
  managerId: string;
  studentId: string;
  scheduledAt: string;
  notes?: string;
}

interface UpdateDto {
  scheduledAt?: string;
  completedAt?: string | null;
  notes?: string;
}

@Injectable()
export class ManagerSessionsService {
  constructor(private prisma: PrismaService) {}

  async listByManager(managerId: string) {
    return this.prisma.managerSession.findMany({
      where: { managerId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, login: true } },
      },
      take: 100,
    });
  }

  async listByStudent(studentId: string) {
    return this.prisma.managerSession.findMany({
      where: { studentId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        manager: { select: { id: true, name: true } },
      },
      take: 100,
    });
  }

  async create(dto: CreateDto) {
    return this.prisma.managerSession.create({
      data: {
        managerId: dto.managerId,
        studentId: dto.studentId,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
      },
    });
  }

  async update(id: string, managerId: string, dto: UpdateDto) {
    const existing = await this.prisma.managerSession.findFirst({
      where: { id, managerId },
    });
    if (!existing) throw new NotFoundException('Sessiya topilmadi');
    const data: {
      scheduledAt?: Date;
      completedAt?: Date | null;
      notes?: string;
    } = {};
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.completedAt !== undefined)
      data.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.prisma.managerSession.update({ where: { id }, data });
  }

  async markComplete(id: string, managerId: string, notes?: string) {
    return this.update(id, managerId, {
      completedAt: new Date().toISOString(),
      notes,
    });
  }

  async remove(id: string, managerId: string) {
    const existing = await this.prisma.managerSession.findFirst({
      where: { id, managerId },
    });
    if (!existing) throw new NotFoundException('Sessiya topilmadi');
    await this.prisma.managerSession.delete({ where: { id } });
    return { ok: true };
  }
}
