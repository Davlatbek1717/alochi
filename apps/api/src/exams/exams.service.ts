import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExamStatus } from '@prisma/client';

const LEGACY_PASS_THRESHOLD = 0.7;

interface GrantTarget {
  lessonId?: string;
  examId?: string;
}

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  async grant(grantedBy: string, studentId: string, target: GrantTarget) {
    const { lessonId, examId } = target;
    if (!lessonId && !examId) {
      throw new BadRequestException('lessonId yoki examId yuboring');
    }
    if (lessonId && examId) {
      throw new BadRequestException(
        'Bir vaqtda faqat bittasi: lessonId yoki examId',
      );
    }

    if (lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: lessonId },
      });
      if (!lesson) throw new NotFoundException('Dars topilmadi');
      if (!lesson.hasExam)
        throw new BadRequestException('Bu darsda imtihon mavjud emas');

      return this.prisma.examPermission.upsert({
        where: { studentId_lessonId: { studentId, lessonId } },
        create: {
          studentId,
          lessonId,
          grantedBy,
          status: ExamStatus.active,
        },
        update: {
          grantedBy,
          status: ExamStatus.active,
          passed: null,
          score: null,
          completedAt: null,
        },
        include: { lesson: { select: { id: true, title: true } } },
      });
    }

    // Catalogue exam path.
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, isPublished: true },
      include: { _count: { select: { questions: true } } },
    });
    if (!exam) {
      throw new NotFoundException('Imtihon topilmadi yoki nashr qilinmagan');
    }
    if (exam._count.questions === 0) {
      throw new BadRequestException('Bu imtihonda savollar yo‘q');
    }

    return this.prisma.examPermission.upsert({
      where: { studentId_examId: { studentId, examId: examId! } },
      create: {
        studentId,
        examId,
        grantedBy,
        status: ExamStatus.active,
      },
      update: {
        grantedBy,
        status: ExamStatus.active,
        passed: null,
        score: null,
        completedAt: null,
      },
      include: { exam: { select: { id: true, title: true } } },
    });
  }

  async getMyActive(studentId: string) {
    const permission = await this.prisma.examPermission.findFirst({
      where: { studentId, status: ExamStatus.active },
      include: {
        // Both relations included so the controller can serialise
        // either source in a single response without a second query.
        lesson: {
          include: { components_data: { where: { type: 'mcq' } } },
        },
        exam: {
          include: { questions: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    return permission ?? null;
  }

  async submit(examPermissionId: string, studentId: string, answers: number[]) {
    const permission = await this.prisma.examPermission.findUnique({
      where: { id: examPermissionId },
      include: {
        lesson: { include: { components_data: { where: { type: 'mcq' } } } },
        exam: {
          include: { questions: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    if (!permission) throw new NotFoundException('Imtihon topilmadi');
    if (permission.studentId !== studentId) throw new ForbiddenException();
    if (permission.status !== ExamStatus.active)
      throw new BadRequestException('Imtihon allaqachon yakunlangan');

    // Pull correct answers from whichever source this permission targets.
    let correctIndices: number[] = [];
    let passThresholdRatio = LEGACY_PASS_THRESHOLD;
    if (permission.exam) {
      correctIndices = permission.exam.questions.map((q) => q.correctIndex);
      passThresholdRatio = permission.exam.passThreshold / 100;
    } else if (permission.lesson) {
      correctIndices = permission.lesson.components_data.map((c) => {
        const cfg = c.config as { correctIndex: number };
        return cfg.correctIndex;
      });
    }

    const total = correctIndices.length;
    let correct = 0;
    correctIndices.forEach((correctIdx, i) => {
      if (answers[i] === correctIdx) correct++;
    });

    const score = total > 0 ? Math.round((correct / total) * 100) : 100;
    const passed = total === 0 || correct / total >= passThresholdRatio;
    const status = passed ? ExamStatus.done : ExamStatus.failed;

    await this.prisma.examPermission.update({
      where: { id: examPermissionId },
      data: { status, score, passed, completedAt: new Date() },
    });

    // Lesson-anchored exams gate lesson completion. Catalogue exams
    // are standalone — passing them does not auto-complete a lesson.
    if (passed && permission.lessonId) {
      await this.prisma.studentProgress.upsert({
        where: {
          studentId_lessonId: {
            studentId,
            lessonId: permission.lessonId,
          },
        },
        create: {
          studentId,
          lessonId: permission.lessonId,
          academyCompleted: true,
          completedAt: new Date(),
          lastActivityAt: new Date(),
        },
        update: { academyCompleted: true, completedAt: new Date() },
      });
    }

    return { passed, score, correct, total };
  }

  async getStudentExams(studentId: string) {
    return this.prisma.examPermission.findMany({
      where: { studentId },
      include: {
        lesson: { select: { id: true, title: true, orderNumber: true } },
        exam: { select: { id: true, title: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async getPendingForBranch(branchId: string) {
    return this.prisma.examPermission.findMany({
      where: { status: ExamStatus.active, student: { branchId } },
      include: {
        student: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true, orderNumber: true } },
        exam: { select: { id: true, title: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * Catalogue exams the tester can assign — published, non-empty,
   * scoped to the tester's tenant.
   */
  listAvailableForTester(tenantId: string) {
    return this.prisma.exam.findMany({
      where: {
        tenantId,
        isPublished: true,
        questions: { some: {} },
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        passThreshold: true,
        timeLimitMinutes: true,
        _count: { select: { questions: true } },
      },
    });
  }
}
