import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post()
  @Roles(UserRole.filadmin)
  markPaid(@Body() body: any, @Request() req: any) {
    return this.payments.markPaid({
      ...body,
      tenantId: req.user.tenantId,
      recordedBy: req.user.userId,
      paidAt: new Date(body.paidAt),
    });
  }

  @Get('branch/:branchId')
  @Roles(UserRole.filadmin, UserRole.manager)
  getBranchStatus(
    @Param('branchId') branchId: string,
    @Query('month') month: string,
    @Request() req: any,
  ) {
    return this.payments.getBranchPaymentStatus(branchId, req.user.tenantId, month);
  }

  @Get('student/:studentId')
  @Roles(UserRole.filadmin, UserRole.manager)
  getStudentPayments(@Param('studentId') studentId: string) {
    return this.payments.getStudentPayments(studentId);
  }
}
