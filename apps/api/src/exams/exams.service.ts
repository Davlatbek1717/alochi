import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExamStatus } from '@prisma/client';

const PASS_THRESHOLD = 0.7;

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  async grant(grantedBy: string, studentId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (!lesson.hasExam) throw new BadRequestException("Bu darsda imtihon mavjud emas");

    return this.prisma.examPermission.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, grantedBy, status: ExamStatus.active },
      update: { grantedBy, status: ExamStatus.active, passed: null, score: null, completedAt: null },
      include: { lesson: { select: { id: true, title: true } } },
    });
  }

  async getMyActive(studentId: string) {
    const permission = await this.prisma.examPermission.findFirst({
      where: { studentId, status: ExamStatus.active },
      include: {
        lesson: {
          include: { components_data: { where: { type: 'mcq' } } },
        },
      },
    });
    return permission ?? null;
  }

  async submit(examId: string, studentId: string, answers: number[]) {
    const exam = await this.prisma.examPermission.findUnique({
      where: { id: examId },
      include: { lesson: { include: { components_data: { where: { type: 'mcq' } } } } },
    });
    if (!exam) throw new NotFoundException('Imtihon topilmadi');
    if (exam.studentId !== studentId) throw new ForbiddenException();
    if (exam.status !== ExamStatus.active) throw new BadRequestException('Imtihon allaqachon yakunlangan');

    const questions = exam.lesson.components_data.map((c) => {
      const cfg = c.config as { correctIndex: number };
      return cfg.correctIndex;
    });

    const total = questions.length;
    let correct = 0;
    if (total > 0) {
      questions.forEach((correctIdx, i) => {
        if (answers[i] === correctIdx) correct++;
      });
    }

    const score = total > 0 ? Math.round((correct / total) * 100) : 100;
    const passed = total === 0 || correct / total >= PASS_THRESHOLD;
    const status = passed ? ExamStatus.done : ExamStatus.failed;

    await this.prisma.examPermission.update({
      where: { id: examId },
      data: { status, score, passed, completedAt: new Date() },
    });

    if (passed) {
      await this.prisma.studentProgress.upsert({
        where: { studentId_lessonId: { studentId, lessonId: exam.lessonId } },
        create: { studentId, lessonId: exam.lessonId, academyCompleted: true, completedAt: new Date(), lastActivityAt: new Date() },
        update: { academyCompleted: true, completedAt: new Date() },
      });
    }

    return { passed, score, correct, total };
  }

  async getStudentExams(studentId: string) {
    return this.prisma.examPermission.findMany({
      where: { studentId },
      include: { lesson: { select: { id: true, title: true, orderNumber: true } } },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async getPendingForBranch(branchId: string) {
    return this.prisma.examPermission.findMany({
      where: { status: ExamStatus.active, student: { branchId } },
      include: {
        student: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true, orderNumber: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }
}
