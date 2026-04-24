import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private prisma: PrismaService) {}

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
