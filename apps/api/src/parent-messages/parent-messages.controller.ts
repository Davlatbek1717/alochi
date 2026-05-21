import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ParentMessagesService } from './parent-messages.service';

@UseGuards(JwtAuthGuard)
@Controller('parent-messages')
export class ParentMessagesController {
  constructor(private readonly svc: ParentMessagesService) {}

  @Get('student/:studentId')
  getForStudent(@Request() req: any, @Param('studentId') studentId: string) {
    return this.svc.getForStudent(studentId, req.user.tenantId);
  }

  @Post('student/:studentId/alert')
  sendAlert(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Body('content') content: string,
  ) {
    return this.svc.sendAlert(studentId, req.user.tenantId, content);
  }

  @Post('generate/student/:studentId')
  generateForStudent(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.svc.generateForStudent(studentId, req.user.tenantId);
  }
}
