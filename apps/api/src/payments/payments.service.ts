import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BranchPaymentSummary {
  branchId: string;
  branchName: string;
  total: number;
  paid: number;
  unpaid: number;
  blocked: number;
  totalCollected: number;
}

interface MarkPaidDto {
  tenantId: string;
  studentId: string;
  recordedBy: string;
  month: string;
  amount: number;
  paidAt: Date;
  delegationId?: string;
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  private nextDayMidnight(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async markPaid(dto: MarkPaidDto) {
    const unblockAt = this.nextDayMidnight(dto.paidAt);

    // Phase 21.4: explicit duplicate-detection so the caller gets a clean
    // 409 + machine-readable code instead of a silent overwrite.
    const existing = await this.prisma.payment.findUnique({
      where: {
        studentId_month: { studentId: dto.studentId, month: dto.month },
      },
    });
    if (existing && existing.paidAt) {
      throw new ConflictException({
        code: 'PAYMENT_ALREADY_MARKED',
        message: "Bu oy uchun to'lov allaqachon belgilangan",
        details: { paidAt: existing.paidAt, month: dto.month },
      });
    }

    const payment = await this.prisma.payment.upsert({
      where: {
        studentId_month: { studentId: dto.studentId, month: dto.month },
      },
      create: { ...dto, unblockAt },
      update: {
        amount: dto.amount,
        paidAt: dto.paidAt,
        recordedBy: dto.recordedBy,
        unblockAt,
      },
    });

    if (dto.delegationId) {
      await this.prisma.delegationAuditLog.create({
        data: {
          delegationId: dto.delegationId,
          actorId: dto.recordedBy,
          actionType: 'payment_marked',
          targetId: dto.studentId,
          meta: {
            paymentId: payment.id,
            month: dto.month,
            amount: dto.amount,
          },
        },
      });
    }

    return payment;
  }

  async getStudentPayments(studentId: string, tenantId: string) {
    return this.prisma.payment.findMany({
      where: { studentId, tenantId },
      orderBy: { month: 'desc' },
    });
  }

  async getBranchPaymentStatus(
    branchId: string,
    tenantId: string,
    month: string,
  ) {
    const students = await this.prisma.user.findMany({
      where: {
        branchId,
        tenantId,
        role: 'student',
        status: { not: 'inactive' },
      },
      select: { id: true, name: true, status: true },
    });

    const payments = await this.prisma.payment.findMany({
      where: { tenantId, month },
      select: { studentId: true, amount: true, paidAt: true },
    });

    const paidSet = new Set(payments.map((p) => p.studentId));

    return students.map((s) => ({
      ...s,
      hasPaid: paidSet.has(s.id),
      payment: payments.find((p) => p.studentId === s.id) ?? null,
    }));
  }

  async getSettingForTenant(tenantId: string) {
    return this.prisma.paymentSetting.findUnique({ where: { tenantId } });
  }

  async updateSettings(
    tenantId: string,
    startDay: number,
    endDay: number,
    updatedBy: string,
  ) {
    return this.prisma.paymentSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        paymentStartDay: startDay,
        paymentEndDay: endDay,
        updatedBy,
      },
      update: { paymentStartDay: startDay, paymentEndDay: endDay, updatedBy },
    });
  }

  async getBranchSummary(
    tenantId: string,
    month: string,
  ): Promise<BranchPaymentSummary[]> {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: { not: 'inactive' } },
      select: { id: true, branchId: true, status: true },
    });

    const payments = await this.prisma.payment.findMany({
      where: { tenantId, month },
      select: { studentId: true, amount: true },
    });

    const paymentMap = new Map(payments.map((p) => [p.studentId, p.amount]));

    return branches.map((branch) => {
      const branchStudents = students.filter((s) => s.branchId === branch.id);
      const paidStudents = branchStudents.filter((s) => paymentMap.has(s.id));
      const blockedStudents = branchStudents.filter(
        (s) => !paymentMap.has(s.id) && s.status === 'blocked_payment',
      );
      const unpaidStudents = branchStudents.filter(
        (s) => !paymentMap.has(s.id) && s.status !== 'blocked_payment',
      );
      const totalCollected = paidStudents.reduce(
        (sum, s) => sum + (paymentMap.get(s.id) ?? 0),
        0,
      );

      return {
        branchId: branch.id,
        branchName: branch.name,
        total: branchStudents.length,
        paid: paidStudents.length,
        unpaid: unpaidStudents.length,
        blocked: blockedStudents.length,
        totalCollected,
      };
    });
  }
}
