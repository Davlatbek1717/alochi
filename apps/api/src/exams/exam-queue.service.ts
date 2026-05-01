import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface JoinInput {
  tenantId: string;
  branchId: string;
  studentId: string;
  lessonId: string;
}

/**
 * 25.G.1: Persistent exam queue. Frontend reads from server instead of holding
 * waiting students in memory. State machine: waiting → in_progress → completed.
 */
@Injectable()
export class ExamQueueService {
  constructor(private prisma: PrismaService) {}

  async join(input: JoinInput) {
    const existing = await this.prisma.examQueueEntry.findFirst({
      where: {
        studentId: input.studentId,
        lessonId: input.lessonId,
        status: { in: ['waiting', 'in_progress'] },
      },
    });
    if (existing) return existing;

    return this.prisma.examQueueEntry.create({ data: input });
  }

  async list(branchId: string, tenantId: string) {
    return this.prisma.examQueueEntry.findMany({
      where: { branchId, tenantId, status: { in: ['waiting', 'in_progress'] } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async start(id: string) {
    return this.prisma.examQueueEntry.update({
      where: { id },
      data: { status: 'in_progress', startedAt: new Date() },
    });
  }

  async complete(id: string) {
    return this.prisma.examQueueEntry.update({
      where: { id },
      data: { status: 'completed', endedAt: new Date() },
    });
  }
}
