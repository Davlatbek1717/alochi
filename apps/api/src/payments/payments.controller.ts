import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  /**
   * Branch payment summary, super-admin only.
   * (Stays under `/payments/summary` since the response is multi-branch.)
   */
  @Get('summary')
  @Roles(UserRole.superadmin)
  getBranchSummary(@Query('month') month: string, @Request() req: any) {
    return this.payments.getBranchSummary(req.user.tenantId, month);
  }

  /**
   * GET /payments?branchId=...&month=...  → single-branch payment status.
   * Replaces legacy GET /payments/branch/:branchId.
   */
  @Get()
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  getBranchStatus(
    @Query('branchId') branchId: string,
    @Query('month') month: string,
    @Request() req: any,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId query param majburiy');
    }
    return this.payments.getBranchPaymentStatus(
      branchId,
      req.user.tenantId,
      month,
    );
  }

  /**
   * GET /payments/:studentId/status → payment history for a student.
   * Replaces legacy GET /payments/student/:studentId.
   */
  @Get(':studentId/status')
  @Roles(UserRole.filadmin, UserRole.manager)
  getStudentPayments(@Param('studentId') studentId: string) {
    return this.payments.getStudentPayments(studentId);
  }

  /**
   * POST /payments/:studentId  → mark monthly payment as paid for a student.
   * Replaces legacy POST /payments (body.studentId).
   */
  @Post(':studentId')
  @Roles(UserRole.filadmin)
  markPaid(
    @Param('studentId') studentId: string,
    @Body()
    body: {
      month: string;
      amount: number;
      paidAt: string;
      delegationId?: string;
    },
    @Request() req: any,
  ) {
    return this.payments.markPaid({
      ...body,
      studentId,
      tenantId: req.user.tenantId,
      recordedBy: req.user.userId,
      paidAt: new Date(body.paidAt),
    });
  }
}
