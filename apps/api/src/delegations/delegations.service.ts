import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface CreateDelegationDto {
  tenantId: string;
  branchId: string;
  fromUserId: string;
  toUserId: string;
  delegatedRole: string;
  permissions: string[];
  reason: string;
  startsAt: Date;
  endsAt: Date;
}

const ALLOWED_DELEGATED_ROLES = ['filadmin', 'manager'];

@Injectable()
export class DelegationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async create(dto: CreateDelegationDto) {
    if (!dto.reason.trim()) throw new BadRequestException('Sabab majburiy');

    if (!ALLOWED_DELEGATED_ROLES.includes(dto.delegatedRole)) {
      throw new BadRequestException('Faqat filadmin yoki manager roliga delegatsiya mumkin');
    }

    const existing = await this.prisma.delegation.findFirst({
      where: { toUserId: dto.toUserId, status: 'active' },
    });
    if (existing) {
      throw new BadRequestException('Bu xodimda faol delegatsiya mavjud');
    }

    const delegation = await this.prisma.delegation.create({ data: dto });

    await this.prisma.delegationAuditLog.create({
      data: {
        delegationId: delegation.id,
        actorId: dto.fromUserId,
        actionType: 'delegation_created',
        meta: { reason: dto.reason, permissions: dto.permissions },
      },
    });

    const fromUser = await this.prisma.user.findUnique({ where: { id: dto.fromUserId }, select: { name: true } });
    this.events.emit('delegation.created', {
      toUserId: dto.toUserId,
      fromUserName: fromUser?.name ?? '',
      role: dto.delegatedRole,
      endsAt: dto.endsAt.toISOString().split('T')[0],
      reason: dto.reason,
    });

    return delegation;
  }

  async respond(
    delegationId: string,
    responderId: string,
    action: 'accepted' | 'rejected',
    reason?: string,
  ) {
    if (action === 'rejected' && !reason?.trim()) {
      throw new BadRequestException('Rad etish sababi majburiy');
    }

    const delegation = await this.prisma.delegation.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) throw new NotFoundException('Delegatsiya topilmadi');
    if (delegation.status !== 'pending') {
      throw new BadRequestException('Delegatsiya holati kutilmoqda emas');
    }
    if (delegation.toUserId !== responderId) {
      throw new ForbiddenException('Siz bu delegatsiyaga javob bera olmaysiz');
    }

    const newStatus = action === 'accepted' ? 'active' : 'rejected';

    const [updated] = await Promise.all([
      this.prisma.delegation.update({
        where: { id: delegationId },
        data: { status: newStatus },
      }),
      this.prisma.delegationResponse.create({
        data: { delegationId, action, reason },
      }),
      this.prisma.delegationAuditLog.create({
        data: {
          delegationId,
          actorId: responderId,
          actionType: action,
          meta: { reason },
        },
      }),
    ]);

    if (action === 'rejected') {
      const toUser = await this.prisma.user.findUnique({ where: { id: responderId }, select: { name: true } });
      this.events.emit('delegation.rejected', {
        fromUserId: delegation.fromUserId,
        toUserName: toUser?.name ?? '',
        reason: reason ?? '',
      });
    }

    return updated;
  }

  async cancel(delegationId: string, cancelledBy: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException('Bekor qilish sababi majburiy');

    const delegation = await this.prisma.delegation.findUnique({ where: { id: delegationId } });
    if (!delegation) throw new NotFoundException('Delegatsiya topilmadi');

    if (!['pending', 'active'].includes(delegation.status)) {
      throw new BadRequestException('Delegatsiya allaqachon yakunlangan');
    }

    const [updated] = await Promise.all([
      this.prisma.delegation.update({
        where: { id: delegationId },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy, cancelReason: reason },
      }),
      this.prisma.delegationAuditLog.create({
        data: { delegationId, actorId: cancelledBy, actionType: 'cancelled', meta: { reason } },
      }),
    ]);

    const fromUser = await this.prisma.user.findUnique({ where: { id: cancelledBy }, select: { name: true } });
    this.events.emit('delegation.cancelled', {
      toUserId: delegation.toUserId,
      fromUserName: fromUser?.name ?? '',
      reason,
    });

    return updated;
  }

  async findForUser(userId: string) {
    return this.prisma.delegation.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        responses: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(delegationId: string) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id: delegationId },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        responses: true,
        auditLogs: { orderBy: { performedAt: 'asc' } },
      },
    });
    if (!delegation) throw new NotFoundException('Delegatsiya topilmadi');
    return delegation;
  }

  async exportToPdf(delegationId: string): Promise<Buffer> {
    const delegation = await this.findOne(delegationId);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const statusLabel: Record<string, string> = {
      pending: 'Kutilmoqda',
      active: 'Faol',
      rejected: 'Rad etilgan',
      cancelled: 'Bekor qilingan',
      completed: 'Yakunlangan',
    };

    const row = (label: string, value: string) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
    };

    doc.fontSize(22).font('Helvetica-Bold').text("Delegatsiya Hujjati", { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('gray').text(`ID: ${delegation.id}`, { align: 'center' });
    doc.fillColor('black').moveDown(1.5);

    row('Kim tomonidan', delegation.fromUser.name);
    row('Kimga', delegation.toUser.name);
    row('Delegatsiya roli', delegation.delegatedRole);
    row('Sabab', delegation.reason);
    row('Boshlanish', delegation.startsAt.toLocaleDateString('uz-UZ'));
    row('Tugash', delegation.endsAt.toLocaleDateString('uz-UZ'));
    row('Holat', statusLabel[delegation.status] ?? delegation.status);

    if (delegation.cancelReason) {
      row('Bekor qilish sababi', delegation.cancelReason);
    }

    if (delegation.auditLogs.length > 0) {
      doc.moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').text('Audit logi');
      doc.moveDown(0.5);

      for (const log of delegation.auditLogs) {
        const time = log.performedAt.toLocaleString('uz-UZ');
        doc.fontSize(10).font('Helvetica').text(`• [${time}] ${log.actionType}`, { indent: 10 });
      }
    }

    doc.end();
    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async getAuditLog(delegationId: string) {
    return this.prisma.delegationAuditLog.findMany({
      where: { delegationId },
      orderBy: { performedAt: 'asc' },
    });
  }

  async logAction(
    delegationId: string,
    actorId: string,
    actionType: string,
    targetId?: string,
    meta?: object,
  ) {
    return this.prisma.delegationAuditLog.create({
      data: { delegationId, actorId, actionType, targetId, meta },
    });
  }
}
