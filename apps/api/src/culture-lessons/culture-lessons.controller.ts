import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CultureLessonsService } from './culture-lessons.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('culture-lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CultureLessonsController {
  constructor(private cultureLessons: CultureLessonsService) {}

  @Get('today/:staffId')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
    UserRole.tester,
  )
  getToday(@Param('staffId') staffId: string) {
    return this.cultureLessons.getToday(staffId);
  }

  @Post('today')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
    UserRole.tester,
  )
  markToday(@Request() req: any, @Body('notes') notes?: string) {
    return this.cultureLessons.markToday(req.user.userId, notes);
  }

  @Get('missed')
  @Roles(
    UserRole.superadmin,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.mentor,
    UserRole.tester,
  )
  getMissed(@Query('staffId') staffId: string, @Request() req: any) {
    const target = staffId || req.user.userId;
    return this.cultureLessons.getMissed(target);
  }
}
