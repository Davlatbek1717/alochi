import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { XpService } from '../gamification/xp.service';

interface CreateTaskDto {
  tenantId: string;
  branchId: string;
  createdBy: string;
  assignedTo: string;
  title: string;
  description?: string;
  checklist?: { text: string; done: boolean }[];
  deadline?: string;
  kpiBall?: number;
}

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private xp: XpService,
    private events: EventEmitter2,
  ) {}

  async create(dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        createdBy: dto.createdBy,
        assignedTo: dto.assignedTo,
        title: dto.title,
        description: dto.description,
        checklist: dto.checklist ?? [],
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        kpiBall: dto.kpiBall ?? 0,
        status: 'sent',
      },
      include: {
        creator: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    });

    this.events.emit('task.assigned', {
      taskId: task.id,
      assigneeId: task.assignedTo,
      createdBy: task.createdBy,
      deadline: task.deadline ? task.deadline.toISOString() : null,
      title: task.title,
    });

    return task;
  }

  getMyTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { assignedTo: userId },
      include: { creator: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  getSentTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { createdBy: userId },
      include: { assignee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Filadmin dashboard helper — returns all tasks for a branch optionally
   * filtered by status. "pending" is a synthetic alias that maps to
   * tasks whose status is in {sent, seen, in_progress}.
   */
  getByBranch(branchId: string, status?: string) {
    const where: {
      branchId: string;
      status?: TaskStatus | { in: TaskStatus[] };
    } = { branchId };
    const KNOWN_STATUSES: TaskStatus[] = [
      TaskStatus.sent,
      TaskStatus.seen,
      TaskStatus.in_progress,
      TaskStatus.done,
      TaskStatus.confirmed,
    ];
    if (status === 'pending') {
      where.status = {
        in: [TaskStatus.sent, TaskStatus.seen, TaskStatus.in_progress],
      };
    } else if (status && KNOWN_STATUSES.includes(status as TaskStatus)) {
      where.status = status as TaskStatus;
    }
    return this.prisma.task.findMany({
      where,
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(taskId: string, userId: string, status: TaskStatus) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Vazifa topilmadi');
    if (task.assignedTo !== userId)
      throw new ForbiddenException('Bu vazifa sizga tegishli emas');

    const allowed: Record<string, TaskStatus[]> = {
      sent: [TaskStatus.seen, TaskStatus.in_progress],
      seen: [TaskStatus.in_progress],
      in_progress: [TaskStatus.done],
    };
    if (!allowed[task.status]?.includes(status)) {
      throw new ForbiddenException(
        `${task.status} → ${status} o'tish mumkin emas`,
      );
    }

    const data: {
      status: TaskStatus;
      seenAt?: Date;
      startedAt?: Date;
    } = { status };
    if (status === TaskStatus.seen && !task.seenAt) data.seenAt = new Date();
    if (status === TaskStatus.in_progress && !task.startedAt)
      data.startedAt = new Date();

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data,
    });

    // 25.K.2: emit task.completed when caller transitions to `done`.
    if (status === TaskStatus.done) {
      this.events.emit('task.completed', {
        taskId,
        title: task.title,
        creatorId: task.createdBy,
        completedBy: userId,
        tenantId: task.tenantId,
      });
    }

    return updated;
  }

  /**
   * Edit task fields. Only the creator may edit. Cannot change `assignedTo`
   * once the assignee has interacted (status > sent).
   */
  async update(
    taskId: string,
    userId: string,
    patch: {
      title?: string;
      description?: string;
      kpiBall?: number;
      deadline?: string | null;
      assignedTo?: string;
    },
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Vazifa topilmadi');
    if (task.createdBy !== userId)
      throw new ForbiddenException('Faqat yaratuvchi tahrirlay oladi');
    if (task.status !== 'sent' && patch.assignedTo)
      throw new ForbiddenException(
        'Bajaruvchi ko‘rgan vazifani boshqaga berib bo‘lmaydi',
      );
    const data: {
      title?: string;
      description?: string;
      kpiBall?: number;
      deadline?: Date | null;
      assignedTo?: string;
    } = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.kpiBall !== undefined) data.kpiBall = patch.kpiBall;
    if (patch.deadline !== undefined)
      data.deadline = patch.deadline ? new Date(patch.deadline) : null;
    if (patch.assignedTo !== undefined) data.assignedTo = patch.assignedTo;
    return this.prisma.task.update({ where: { id: taskId }, data });
  }

  /**
   * Delete a task. Only the creator may delete, and only while the task is
   * still in the `sent` state (avoids orphaning KPI rows or removing audit
   * trail of completed work).
   */
  async remove(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Vazifa topilmadi');
    if (task.createdBy !== userId)
      throw new ForbiddenException('Faqat yaratuvchi o‘chira oladi');
    if (task.status !== 'sent')
      throw new ForbiddenException(
        'Boshlanib qolgan vazifani o‘chirib bo‘lmaydi',
      );
    await this.prisma.task.delete({ where: { id: taskId } });
    return { ok: true };
  }

  async confirm(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Vazifa topilmadi');
    if (task.createdBy !== userId)
      throw new ForbiddenException('Faqat yaratuvchi tasdiqlashi mumkin');
    if (task.status !== 'done')
      throw new ForbiddenException('Vazifa hali bajarilmagan');

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

    if (task.kpiBall > 0) {
      await this.prisma.kpiScore.create({
        data: {
          userId: task.assignedTo,
          tenantId: task.tenantId,
          score: task.kpiBall,
          reason: `Vazifa: ${task.title}`,
          taskId: task.id,
          date: new Date(),
        },
      });
      await this.xp.award(task.assignedTo, 'daily_quest', { taskId: task.id });
    }

    return updated;
  }
}
