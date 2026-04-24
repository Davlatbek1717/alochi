import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLessonDto) {
    const existing = await this.prisma.lesson.findFirst({
      where: { tenantId: dto.tenantId, orderNumber: dto.orderNumber },
    });
    if (existing) throw new ConflictException(`${dto.orderNumber} tartib raqami allaqachon mavjud`);

    const { mcqEnabled, wordOrderEnabled, vocabularyEnabled, type, ...data } = dto;
    return this.prisma.lesson.create({
      data: {
        ...data,
        type: type as any,
        components: {
          mcq: mcqEnabled ?? false,
          word_order: wordOrderEnabled ?? false,
          vocabulary: vocabularyEnabled ?? false,
          ai_tutor: false,
          camera: false,
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

  async getNextLesson(studentId: string, tenantId: string) {
    const completed = await this.prisma.studentProgress.findMany({
      where: { studentId, academyCompleted: true },
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
