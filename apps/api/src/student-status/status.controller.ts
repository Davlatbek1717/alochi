import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StatusService } from './status.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

interface AuthRequest extends Request {
  user: {
    userId: string;
    tenantId: string;
    role: UserRole;
    branchId?: string | null;
  };
}

@ApiTags('student-status')
@ApiBearerAuth()
@Controller('status')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatusController {
  constructor(private statusService: StatusService) {}

  @Post()
  @Roles(UserRole.mentor, UserRole.manager)
  setStatus(
    @Body()
    body: {
      studentId: string;
      date: string;
      englishStatus?: string;
      englishNote?: string;
      personalStatus?: string;
      personalNote?: string;
      criticalStatus?: string;
      criticalNote?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.statusService.setStatus({
      ...body,
      tenantId: req.user.tenantId,
      changedBy: req.user.userId,
    });
  }

  @Get('my')
  @Roles(UserRole.student)
  getMyStatus(@Request() req: AuthRequest) {
    return this.statusService.getLatest(req.user.userId);
  }

  @Get('red-students')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getRedStudents(@Request() req: AuthRequest) {
    return this.statusService.getRedStudents(req.user.tenantId);
  }

  @Get('yellow-students')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getYellowStudents(@Request() req: AuthRequest) {
    return this.statusService.getYellowStudents(req.user.tenantId);
  }

  @Get('high-performers')
  @Roles(UserRole.manager, UserRole.filadmin)
  getHighPerformers(@Request() req: AuthRequest) {
    return this.statusService.getHighPerformers(
      req.user.tenantId,
      req.user.branchId,
    );
  }

  @Get('history/:studentId')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getHistory(@Param('studentId') studentId: string) {
    return this.statusService.getHistory(studentId);
  }

  @Get(':studentId')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getStudentStatus(@Param('studentId') studentId: string) {
    return this.statusService.getLatest(studentId);
  }
}
