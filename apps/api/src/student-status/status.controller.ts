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
import { SetPersonalStatusDto } from './dto/set-personal-status.dto';
import { SetCriticalStatusDto } from './dto/set-critical-status.dto';

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

  /**
   * Mentor sets a student's PERSONAL status colour.
   * Spec §5.2: when personal=yashil and english=yashil, critical
   * is auto-set to yashil and a notification is sent to the manager.
   */
  @Post('personal')
  @Roles(UserRole.mentor)
  setPersonal(@Body() dto: SetPersonalStatusDto, @Request() req: AuthRequest) {
    return this.statusService.setPersonalStatus(
      {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
      },
      dto,
    );
  }

  /**
   * Manager / filadmin sets a student's CRITICAL status colour.
   * Sariq / qizil values trigger an additional filadmin notification
   * (Phase 6 will route this to Telegram).
   */
  @Post('critical')
  @Roles(UserRole.manager, UserRole.filadmin)
  setCritical(@Body() dto: SetCriticalStatusDto, @Request() req: AuthRequest) {
    return this.statusService.setCriticalStatus(
      {
        userId: req.user.userId,
        tenantId: req.user.tenantId,
        role: req.user.role,
      },
      dto,
    );
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
