import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';
import { ExamStatus } from '@prisma/client';

const LEGACY_PASS_THRESHOLD = 0.7;

interface GrantTarget {
  lessonId?: string;
  examId?: string;
}

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private i18n: I18nService,
  ) {}

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
      if (!lesson) throw new NotFoundException(this.i18n.t('lesson_not_found'));
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
      throw new NotFoundException(this.i18n.t('exam_not_found'));
    }
    // Test-kind exams must have at least one question. AI oral exams
    // have no question rows — they're driven by `aiPrompt`, which
    // must be present to be valid.
    if (exam.kind === 'test' && exam._count.questions === 0) {
      throw new BadRequestException("Bu imtihonda savollar yo'q");
    }
    if (exam.kind === 'ai_oral' && !exam.aiPrompt?.trim()) {
      throw new BadRequestException('AI imtihonida prompt sozlanmagan');
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
    const includeShape = {
      // Both lesson + exam relations are included so the controller
      // can serialise whichever source the permission targets in a
      // single response. `oralSession` carries the saved transcript +
      // score for ai_oral exams, so the frontend can rehydrate the
      // result screen on refresh without another round trip.
      lesson: {
        include: { components_data: { where: { type: 'mcq' } } },
      },
      exam: {
        include: { questions: { orderBy: { orderIndex: 'asc' } } },
      },
      oralSession: true,
    } as const;

    const active = await this.prisma.examPermission.findFirst({
      where: { studentId, status: ExamStatus.active },
      include: includeShape,
    });
    if (active) return active;

    // No active exam — surface the MOST RECENT completed/failed exam
    // within the last 24 hours so a student who just finished can
    // refresh the page and still see their score + AI analysis.
    // Older results stay accessible only via history pages (future).
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.examPermission.findFirst({
      where: {
        studentId,
        status: { in: [ExamStatus.done, ExamStatus.failed] },
        completedAt: { gte: dayAgo },
      },
      orderBy: { completedAt: 'desc' },
      include: includeShape,
    });
    return recent ?? null;
  }

  async submit(
    examPermissionId: string,
    studentId: string,
    payload: { answers?: number[]; results?: boolean[] },
  ) {
    const permission = await this.prisma.examPermission.findUnique({
      where: { id: examPermissionId },
      include: {
        lesson: { include: { components_data: { where: { type: 'mcq' } } } },
        exam: {
          include: { questions: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    if (!permission) throw new NotFoundException(this.i18n.t('exam_not_found'));
    if (permission.studentId !== studentId) throw new ForbiddenException();
    if (permission.status !== ExamStatus.active)
      throw new BadRequestException(this.i18n.t('exam_already_done'));

    // Two grading paths:
    //   - Catalogue exam → client sends `results: boolean[]` because
    //     polymorphic question types (12 supported) are easier to
    //     grade on the client where the per-type renderers already
    //     live; server just tallies.
    //   - Legacy lesson exam → client sends `answers: number[]` (MCQ
    //     option index per question); server compares to stored
    //     correctIndex.
    let total = 0;
    let correct = 0;
    let passThresholdRatio = LEGACY_PASS_THRESHOLD;

    if (permission.exam) {
      total = permission.exam.questions.length;
      const results = payload.results ?? [];
      correct = results.slice(0, total).filter(Boolean).length;
      passThresholdRatio = permission.exam.passThreshold / 100;
    } else if (permission.lesson) {
      const correctIndices = permission.lesson.components_data.map((c) => {
        const cfg = c.config as { correctIndex: number };
        return cfg.correctIndex;
      });
      total = correctIndices.length;
      const answers = payload.answers ?? [];
      correctIndices.forEach((correctIdx, i) => {
        if (answers[i] === correctIdx) correct++;
      });
    }

    // total === 0 means we found a permission whose lesson/exam has
    // zero gradable questions. Without this guard the next two lines
    // would auto-award 100% and mark the exam passed, which a mentor
    // could exploit by granting a lesson-bound permission for any
    // lesson that happens to have no MCQ components — the student
    // would auto-complete the lesson without answering anything.
    if (total === 0) {
      throw new BadRequestException(this.i18n.t('no_questions'));
    }
    const score = Math.round((correct / total) * 100);
    const passed = correct / total >= passThresholdRatio;
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
        exam: {
          select: {
            id: true,
            title: true,
            kind: true,
            passThreshold: true,
          },
        },
        // Pull the oral session so the staff-facing UI can render the
        // AI analysis (strengths / weaknesses / recommendations) and the
        // full transcript on the same screen — no extra round-trip.
        oralSession: {
          select: {
            id: true,
            status: true,
            score: true,
            passed: true,
            completedAt: true,
            aiAnalysis: true,
            transcript: true,
          },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /** Tester cancels a granted exam permission before the student submits. */
  async cancelPermission(id: string) {
    const permission = await this.prisma.examPermission.findUnique({
      where: { id },
    });
    if (!permission) throw new NotFoundException('Ruxsat topilmadi');
    if (permission.status !== ExamStatus.active) {
      throw new BadRequestException('Bu ruxsat allaqachon tugagan');
    }
    return this.prisma.examPermission.update({
      where: { id },
      data: { status: ExamStatus.failed, completedAt: new Date() },
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
   * Catalogue exams the tester can assign — published, scoped to the
   * tester's tenant. Test-kind exams must have at least one question;
   * ai_oral-kind exams must have a non-empty `aiPrompt`. Both
   * conditions are OR'd via two top-level filters.
   */
  listAvailableForTester(tenantId: string) {
    return this.prisma.exam.findMany({
      where: {
        tenantId,
        isPublished: true,
        OR: [
          { kind: 'test', questions: { some: {} } },
          { kind: 'ai_oral', NOT: { aiPrompt: null } },
        ],
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        language: true,
        maxMinutes: true,
        questionCount: true,
        passThreshold: true,
        timeLimitMinutes: true,
        orderNumber: true,
        _count: { select: { questions: true } },
      },
    });
  }

  /**
   * Tenant-ordered catalogue exams + the eligible (assignable) set.
   * Eligible mirrors listAvailableForTester: published, with content.
   */
  private async orderedExams(tenantId: string) {
    return this.prisma.exam.findMany({
      where: {
        tenantId,
        isPublished: true,
        OR: [
          { kind: 'test', questions: { some: {} } },
          { kind: 'ai_oral', NOT: { aiPrompt: null } },
        ],
      },
      orderBy: [
        { orderNumber: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
      select: { id: true, title: true, orderNumber: true },
    });
  }

  /**
   * Where a student is in the tenant's exam sequence. `currentOrder`
   * is the 1-based position of the first not-yet-passed exam (mirrors
   * the lesson "current step" pattern); when every exam is passed it
   * equals totalExams and `allDone` is true.
   */
  async getStudentExamProgress(studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { tenantId: true },
    });
    if (!student) throw new NotFoundException(this.i18n.t('user_not_found'));

    const exams = await this.orderedExams(student.tenantId);
    const total = exams.length;

    const perms = await this.prisma.examPermission.findMany({
      where: { studentId, examId: { not: null } },
      select: { examId: true, status: true, passed: true },
    });
    const passedSet = new Set(
      perms
        .filter((p) => p.passed === true || p.status === ExamStatus.done)
        .map((p) => p.examId as string),
    );
    const activeSet = new Set(
      perms
        .filter((p) => p.status === ExamStatus.active)
        .map((p) => p.examId as string),
    );

    const passedCount = exams.filter((e) => passedSet.has(e.id)).length;
    const currentIdx = exams.findIndex((e) => !passedSet.has(e.id));
    const current = currentIdx === -1 ? null : exams[currentIdx];
    const allDone = total > 0 && currentIdx === -1;

    return {
      totalExams: total,
      passedCount,
      // Lesson-parity: the displayed "current #" is passed+1 (capped at
      // total), so "#M / N · P passed" always reads M = P+1. The actual
      // next exam to take is `current` (first not-yet-passed in order),
      // which may differ if exams were passed out of sequence.
      currentOrder:
        total === 0 ? 0 : Math.min(passedCount + 1, total),
      currentExamId: current?.id ?? null,
      currentExamTitle: current?.title ?? null,
      currentGranted: current ? activeSet.has(current.id) : false,
      allDone,
    };
  }

  /**
   * Tester grants the student's next `count` (1–20) un-passed,
   * un-granted catalogue exams in sequence order — so they don't have
   * to hand-pick. Returns the freshly granted permissions + the
   * recomputed progress so the UI can update in one round trip.
   */
  async grantNext(grantedBy: string, studentId: string, count = 1) {
    const n = Math.max(1, Math.min(20, Math.round(count || 1)));
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { tenantId: true },
    });
    if (!student) throw new NotFoundException(this.i18n.t('user_not_found'));

    const exams = await this.orderedExams(student.tenantId);
    const perms = await this.prisma.examPermission.findMany({
      where: { studentId, examId: { not: null } },
      select: { examId: true, status: true, passed: true },
    });
    const passedSet = new Set(
      perms
        .filter((p) => p.passed === true || p.status === ExamStatus.done)
        .map((p) => p.examId as string),
    );
    const activeSet = new Set(
      perms
        .filter((p) => p.status === ExamStatus.active)
        .map((p) => p.examId as string),
    );

    const targets = exams
      .filter((e) => !passedSet.has(e.id) && !activeSet.has(e.id))
      .slice(0, n);
    if (targets.length === 0) {
      throw new BadRequestException(
        'Berish uchun navbatdagi imtihon qolmadi',
      );
    }

    const granted = [];
    for (const e of targets) {
      const p = await this.prisma.examPermission.upsert({
        where: { studentId_examId: { studentId, examId: e.id } },
        create: {
          studentId,
          examId: e.id,
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
        include: {
          exam: { select: { id: true, title: true, orderNumber: true } },
        },
      });
      granted.push(p);
    }

    const progress = await this.getStudentExamProgress(studentId);
    return { granted, progress };
  }
}
