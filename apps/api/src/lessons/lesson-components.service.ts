import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLessonComponentDto,
  UpdateLessonComponentDto,
} from './dto/create-component.dto';

/**
 * Pass 1: generic CRUD for lesson components — works for any of the 12
 * `COMPONENT_TYPES`. The legacy {@link ComponentsService} (set-by-type
 * endpoints used by the existing MCQ / word-order / vocabulary flows)
 * remains for back-compat; this service is what the new exercise types
 * (translate, listen_pick, ...) lean on so each one doesn't need its own
 * dedicated endpoint pair.
 *
 * All writes verify that the parent lesson belongs to the caller's tenant
 * before mutating, so a superadmin from tenant A can't poke components on
 * tenant B's lesson.
 */
@Injectable()
export class LessonComponentsService {
  constructor(private prisma: PrismaService) {}

  private async assertLessonInTenant(lessonId: string, tenantId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenantId },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  async create(
    lessonId: string,
    tenantId: string,
    dto: CreateLessonComponentDto,
  ) {
    await this.assertLessonInTenant(lessonId, tenantId);
    return this.prisma.lessonComponent.create({
      data: {
        lessonId,
        type: dto.type,
        // Prisma's Json input type accepts any plain object — the cast keeps
        // strict-mode TypeScript happy without disabling typechecking.
        config: dto.config as object,
      },
    });
  }

  async update(
    lessonId: string,
    componentId: string,
    tenantId: string,
    dto: UpdateLessonComponentDto,
  ) {
    await this.assertLessonInTenant(lessonId, tenantId);
    const component = await this.prisma.lessonComponent.findFirst({
      where: { id: componentId, lessonId },
    });
    if (!component) throw new NotFoundException('Komponent topilmadi');
    if (component.lessonId !== lessonId) {
      // Belt-and-suspenders: refuse cross-lesson PATCH attempts.
      throw new ForbiddenException('Komponent bu darsga tegishli emas');
    }
    return this.prisma.lessonComponent.update({
      where: { id: componentId },
      data: {
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.config ? { config: dto.config as object } : {}),
      },
    });
  }

  async remove(lessonId: string, componentId: string, tenantId: string) {
    await this.assertLessonInTenant(lessonId, tenantId);
    const component = await this.prisma.lessonComponent.findFirst({
      where: { id: componentId, lessonId },
    });
    if (!component) throw new NotFoundException('Komponent topilmadi');
    return this.prisma.lessonComponent.delete({
      where: { id: componentId },
    });
  }
}
