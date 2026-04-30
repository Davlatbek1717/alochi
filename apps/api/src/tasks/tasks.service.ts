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

    return this.prisma.task.update({
      where: { id: taskId },
      data,
    });
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
