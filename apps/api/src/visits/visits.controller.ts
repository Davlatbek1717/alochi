import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { VisitsService } from './visits.service';
import { VisitStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  create(
    @Request() req: any,
    @Body() body: {
      studentId: string;
      visitorId: string;
      branchId: string;
      scheduledFor: string;
      homeAddress?: string;
      homeLatitude?: number;
      homeLongitude?: number;
      riskScoreAtPlan?: number;
    },
  ) {
    return this.visitsService.create({
      ...body,
      scheduledFor: new Date(body.scheduledFor),
      tenantId: req.user.tenantId,
    });
  }

  @Get('today')
  findToday(@Request() req: any) {
    return this.visitsService.findToday(req.user.tenantId, req.user.userId);
  }

  @Get('stats')
  getStats(
    @Request() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.visitsService.getStats(
      req.user.tenantId,
      new Date(from),
      new Date(to),
    );
  }

  @Get('student/:studentId/history')
  getStudentHistory(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.visitsService.getStudentHistory(studentId, req.user.tenantId);
  }

  @Get('branch/:branchId/coverage')
  getBranchCoverage(
    @Request() req: any,
    @Param('branchId') branchId: string,
  ) {
    return this.visitsService.getBranchCoverage(branchId, req.user.tenantId);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('date') date?: string,
    @Query('status') status?: VisitStatus,
    @Query('visitorId') visitorId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.visitsService.findAll(req.user.tenantId, {
      date,
      status,
      visitorId,
      branchId,
    });
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.visitsService.findById(id, req.user.tenantId);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      scheduledFor?: string;
      homeAddress?: string;
      homeLatitude?: number;
      homeLongitude?: number;
      outcome?: string;
      notes?: string;
      followUpDate?: string;
      followUpReason?: string;
    },
  ) {
    const { scheduledFor, followUpDate, ...rest } = body;
    return this.visitsService.update(id, req.user.tenantId, {
      ...rest,
      ...(scheduledFor ? { scheduledFor: new Date(scheduledFor) } : {}),
      ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
    });
  }

  @Delete(':id')
  cancel(
    @Request() req: any,
    @Param('id') id: string,
    @Body('cancelReason') cancelReason: string,
  ) {
    return this.visitsService.cancel(id, req.user.tenantId, cancelReason);
  }

  @Post(':id/checkin')
  checkin(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { latitude: number; longitude: number; accuracy: number },
  ) {
    return this.visitsService.checkin(id, req.user.tenantId, body);
  }

  @Post(':id/photos')
  addPhoto(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      category: string;
      s3Key: string;
      thumbnailKey: string;
      caption?: string;
      geoLatitude?: number;
      geoLongitude?: number;
    },
  ) {
    return this.visitsService.addPhoto(id, req.user.tenantId, body);
  }

  @Post(':id/checklist')
  setChecklist(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: Array<{
      templateKey: string;
      label: string;
      status: string;
      notes?: string;
      evidence?: string;
    }>,
  ) {
    return this.visitsService.setChecklist(id, req.user.tenantId, body);
  }

  @Post(':id/issues')
  addIssue(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { category: string; severity: string; description: string },
  ) {
    return this.visitsService.addIssue(id, req.user.tenantId, body);
  }

  @Post(':id/action-items')
  addActionItem(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      description: string;
      priority: string;
      assigneeId?: string;
      dueDate?: string;
      generatedBy?: string;
    },
  ) {
    const { dueDate, ...rest } = body;
    return this.visitsService.addActionItem(id, req.user.tenantId, {
      ...rest,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
    });
  }

  @Post(':id/notes')
  addNotes(
    @Request() req: any,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.visitsService.addNotes(id, req.user.tenantId, notes);
  }

  @Post(':id/parent-signature')
  parentSignature(
    @Request() req: any,
    @Param('id') id: string,
    @Body('pin') pin: string,
  ) {
    return this.visitsService.parentSignature(id, req.user.tenantId, pin);
  }

  @Post(':id/complete')
  complete(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { outcome: string; notes?: string },
  ) {
    return this.visitsService.complete(
      id,
      req.user.tenantId,
      body.outcome,
      body.notes,
    );
  }
}
