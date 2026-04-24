import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    return this.prisma.payment.upsert({
      where: { studentId_month: { studentId: dto.studentId, month: dto.month } },
      create: { ...dto, unblockAt },
      update: { amount: dto.amount, paidAt: dto.paidAt, recordedBy: dto.recordedBy, unblockAt },
    });
  }

  async getStudentPayments(studentId: string) {
    return this.prisma.payment.findMany({
      where: { studentId },
      orderBy: { month: 'desc' },
    });
  }

  async getBranchPaymentStatus(branchId: string, tenantId: string, month: string) {
    const students = await this.prisma.user.findMany({
      where: { branchId, tenantId, role: 'student', status: { not: 'inactive' } },
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

  async updateSettings(tenantId: string, startDay: number, endDay: number, updatedBy: string) {
    return this.prisma.paymentSetting.upsert({
      where: { tenantId },
      create: { tenantId, paymentStartDay: startDay, paymentEndDay: endDay, updatedBy },
      update: { paymentStartDay: startDay, paymentEndDay: endDay, updatedBy },
    });
  }
}
