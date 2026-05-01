import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContactRequest, ContactRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import { UpdateContactRequestDto } from './dto/update-contact-request.dto';

export interface ContactRequestListFilters {
  status?: string;
}

export interface ContactRequestListResult {
  items: ContactRequest[];
  counts: Record<ContactRequestStatus, number> & { total: number };
}

@Injectable()
export class ContactRequestsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  /**
   * Public-facing create. Persists the contact request and emits
   * `contact_request.created` so the notification handler can fan out
   * in-app and Telegram alerts to all superadmins.
   */
  async create(
    dto: CreateContactRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ContactRequest> {
    const created = await this.prisma.contactRequest.create({
      data: {
        centerName: dto.centerName,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        centerSize: dto.centerSize,
        message: dto.message,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    this.events.emit('contact_request.created', created);

    return created;
  }

  async findAll(
    filters: ContactRequestListFilters = {},
  ): Promise<ContactRequestListResult> {
    const where: Prisma.ContactRequestWhereInput = {};
    if (filters.status && this.isValidStatus(filters.status)) {
      where.status = filters.status as ContactRequestStatus;
    }

    const [items, grouped] = await Promise.all([
      this.prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactRequest.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const counts = {
      new: 0,
      contacted: 0,
      demo_scheduled: 0,
      demo_completed: 0,
      converted: 0,
      declined: 0,
      total: 0,
    } as Record<ContactRequestStatus, number> & { total: number };

    for (const row of grouped) {
      const c = row._count._all;
      counts[row.status] = c;
      counts.total += c;
    }

    return { items, counts };
  }

  async findOne(id: string): Promise<ContactRequest> {
    const req = await this.prisma.contactRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException("So'rov topilmadi");
    return req;
  }

  async updateStatus(
    id: string,
    dto: UpdateContactRequestDto,
    handledByUserId: string,
  ): Promise<ContactRequest> {
    const existing = await this.prisma.contactRequest.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("So'rov topilmadi");

    const data: Prisma.ContactRequestUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
      data.handledBy = handledByUserId;
      data.handledAt = new Date();
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
      // notes-only updates still record handler (audit trail)
      if (data.handledBy === undefined) {
        data.handledBy = handledByUserId;
        data.handledAt = new Date();
      }
    }
    if (dto.declineReason !== undefined) {
      data.declineReason = dto.declineReason;
    }

    return this.prisma.contactRequest.update({ where: { id }, data });
  }

  /**
   * Called by TenantsService.onboardTenant after a tenant is successfully
   * created from a demo request. Atomic finalisation of the funnel.
   */
  async markConverted(
    id: string,
    tenantId: string,
    handledByUserId: string,
  ): Promise<ContactRequest> {
    return this.prisma.contactRequest.update({
      where: { id },
      data: {
        status: ContactRequestStatus.converted,
        convertedTenantId: tenantId,
        handledBy: handledByUserId,
        handledAt: new Date(),
      },
    });
  }

  private isValidStatus(s: string): boolean {
    return (Object.values(ContactRequestStatus) as string[]).includes(s);
  }
}
