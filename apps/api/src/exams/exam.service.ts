import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto, UpdateExamDto, ExamQuestionInputDto } from './exam.dto';

/**
 * Superadmin-authored exams. Each exam belongs to a tenant, contains
 * an ordered list of MCQ questions, and is independent of the
 * per-lesson `hasExam` flag the legacy mentor-driven flow uses.
 *
 * The `questions` field on update wipes-and-replaces in a single
 * transaction so the editor can hand us the canonical question list
 * without delta tracking on the client.
 */
@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.exam.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true } },
      },
    });
  }

  async getOne(id: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!exam) throw new NotFoundException('Imtihon topilmadi');
    return exam;
  }

  async create(dto: CreateExamDto, tenantId: string) {
    const kind = dto.kind ?? 'test';
    return this.prisma.exam.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        kind,
        language: kind === 'ai_oral' ? (dto.language ?? 'en') : null,
        aiPrompt: kind === 'ai_oral' ? dto.aiPrompt?.trim() || null : null,
        maxMinutes: kind === 'ai_oral' ? (dto.maxMinutes ?? 10) : null,
        questionCount: kind === 'ai_oral' ? (dto.questionCount ?? 5) : 5,
        passThreshold: dto.passThreshold ?? 70,
        timeLimitMinutes: dto.timeLimitMinutes ?? null,
        isPublished: dto.isPublished ?? false,
        // Oral exams have no question rows — the AI conducts the
        // conversation freely guided by `aiPrompt`. We still allow the
        // questions field through so the editor can switch kinds
        // without losing previously-authored content; it just gets
        // ignored when kind=ai_oral.
        ...(kind === 'test' && dto.questions && dto.questions.length > 0
          ? {
              questions: {
                create: dto.questions.map((q, idx) => mapQuestion(q, idx)),
              },
            }
          : {}),
      },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  async update(id: string, dto: UpdateExamDto, tenantId: string) {
    // Confirm the exam exists in this tenant before any writes.
    await this.getOne(id, tenantId);

    return this.prisma.$transaction(async (tx) => {
      // Field updates.
      const updateData: Record<string, unknown> = {};
      if (dto.title !== undefined) updateData.title = dto.title.trim();
      if (dto.description !== undefined)
        updateData.description = dto.description?.trim() || null;
      if (dto.kind !== undefined) updateData.kind = dto.kind;
      if (dto.language !== undefined) updateData.language = dto.language;
      if (dto.aiPrompt !== undefined)
        updateData.aiPrompt = dto.aiPrompt?.trim() || null;
      if (dto.maxMinutes !== undefined)
        updateData.maxMinutes = dto.maxMinutes ?? null;
      if (dto.questionCount !== undefined)
        updateData.questionCount = dto.questionCount;
      if (dto.passThreshold !== undefined)
        updateData.passThreshold = dto.passThreshold;
      if (dto.timeLimitMinutes !== undefined)
        updateData.timeLimitMinutes = dto.timeLimitMinutes ?? null;
      if (dto.isPublished !== undefined)
        updateData.isPublished = dto.isPublished;

      if (Object.keys(updateData).length > 0) {
        await tx.exam.update({ where: { id }, data: updateData });
      }

      // Replace question set if the caller sent one. An empty array
      // is honored as "clear all questions" — the editor uses this
      // when the user removes every row.
      if (dto.questions !== undefined) {
        await tx.examQuestion.deleteMany({ where: { examId: id } });
        if (dto.questions.length > 0) {
          await tx.examQuestion.createMany({
            data: dto.questions.map((q, idx) => ({
              ...mapQuestion(q, idx),
              examId: id,
            })),
          });
        }
      }

      return tx.exam.findUnique({
        where: { id },
        include: { questions: { orderBy: { orderIndex: 'asc' } } },
      });
    });
  }

  async remove(id: string, tenantId: string) {
    await this.getOne(id, tenantId);
    await this.prisma.exam.delete({ where: { id } });
    return { ok: true };
  }
}

function mapQuestion(q: ExamQuestionInputDto, fallbackOrder: number) {
  return {
    type: q.type,
    config: q.config as unknown as object,
    orderIndex: q.orderIndex ?? fallbackOrder,
  };
}
