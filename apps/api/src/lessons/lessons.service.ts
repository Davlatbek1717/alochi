import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new lesson scoped to `tenantId`.
   * The tenantId is injected by the controller from the caller's JWT so the
   * DTO body never needs to carry it — this prevents a filadmin from creating
   * a lesson inside a different tenant by spoofing the field.
   */
  async create(dto: CreateLessonDto, tenantId: string) {
    const existing = await this.prisma.lesson.findFirst({
      where: { tenantId, orderNumber: dto.orderNumber },
    });
    if (existing)
      throw new ConflictException(
        `${dto.orderNumber} tartib raqami allaqachon mavjud`,
      );

    const {
      mcqEnabled,
      wordOrderEnabled,
      vocabularyEnabled,
      aiTutorEnabled,
      hasExam,
      type,
      ...rest
    } = dto;
    return this.prisma.lesson.create({
      data: {
        ...rest,
        tenantId,
        youtubeUrl: rest.youtubeUrl ?? '',
        nRepetitions: rest.nRepetitions ?? 3,
        type: type as any,
        hasExam: hasExam ?? false,
        components: {
          mcq: mcqEnabled ?? false,
          word_order: wordOrderEnabled ?? false,
          vocabulary: vocabularyEnabled ?? false,
          ai_tutor: aiTutorEnabled ?? false,
        },
      },
    });
  }

  async findByTenant(tenantId: string) {
    return this.prisma.lesson.findMany({
      where: { tenantId },
      orderBy: { orderNumber: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, tenantId },
      include: { components_data: true },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  async publish(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this.prisma.lesson.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  /**
   * 25.B: Patch lesson with cameraEnabled / aiTutorContext / validation-bound
   * fields. Component flags continue to live under `components` JSON.
   */
  async update(id: string, tenantId: string, dto: UpdateLessonDto) {
    await this.findById(id, tenantId);
    const {
      mcqEnabled,
      wordOrderEnabled,
      vocabularyEnabled,
      aiTutorEnabled,
      type,
      ...rest
    } = dto;

    const data: Record<string, unknown> = { ...rest };
    if (type) data.type = type as any;

    const componentsPatch: Record<string, boolean> = {};
    if (mcqEnabled !== undefined) componentsPatch.mcq = mcqEnabled;
    if (wordOrderEnabled !== undefined)
      componentsPatch.word_order = wordOrderEnabled;
    if (vocabularyEnabled !== undefined)
      componentsPatch.vocabulary = vocabularyEnabled;
    if (aiTutorEnabled !== undefined) componentsPatch.ai_tutor = aiTutorEnabled;

    if (Object.keys(componentsPatch).length > 0) {
      const current = await this.prisma.lesson.findUnique({
        where: { id },
        select: { components: true },
      });
      const merged = {
        ...(current?.components as Record<string, unknown> | null | undefined),
        ...componentsPatch,
      };
      data.components = merged;
    }

    return this.prisma.lesson.update({ where: { id }, data });
  }

  /**
   * Delete a lesson. Refused when any student progress rows exist for the
   * lesson — frontends should surface the resulting 409 to the user. Cascading
   * `LessonComponent` rows are removed by the schema-level `onDelete: Cascade`.
   */
  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    const progressCount = await this.prisma.studentProgress.count({
      where: { lessonId: id },
    });
    if (progressCount > 0) {
      throw new ConflictException(
        `Darsda ${progressCount} o'quvchi progressi bor. O'chirib bo'lmaydi.`,
      );
    }
    return this.prisma.lesson.delete({ where: { id } });
  }

  async getNextLesson(studentId: string, tenantId: string) {
    // A lesson counts as "done" for the path/unlock purposes when EITHER the
    // student has finished the home portion (sessionCount >= nRepetitions, set
    // by ProgressService.completeSession) OR a mentor has marked the academy
    // portion complete. Previously this only checked academyCompleted, which
    // meant the student could never unlock the next lesson on their own —
    // /lessons/next kept returning the same lesson forever even after they
    // finished home_completed. Home completion is the student-driven signal
    // and must advance the path.
    const completed = await this.prisma.studentProgress.findMany({
      where: {
        studentId,
        OR: [{ homeCompleted: true }, { academyCompleted: true }],
      },
      select: { lessonId: true },
    });
    const completedIds = completed.map((p) => p.lessonId);

    return this.prisma.lesson.findFirst({
      where: {
        tenantId,
        isPublished: true,
        id: { notIn: completedIds },
      },
      orderBy: { orderNumber: 'asc' },
    });
  }
}
