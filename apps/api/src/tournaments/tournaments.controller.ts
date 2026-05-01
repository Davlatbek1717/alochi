import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('tournaments')
@ApiBearerAuth()
@Controller('tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TournamentsController {
  constructor(private tournaments: TournamentsService) {}

  @Get()
  @Roles(
    UserRole.student,
    UserRole.mentor,
    UserRole.manager,
    UserRole.filadmin,
    UserRole.superadmin,
  )
  list(@Request() req: any) {
    return this.tournaments.list(req.user.tenantId);
  }

  @Post()
  @Roles(UserRole.superadmin, UserRole.filadmin)
  create(
    @Body()
    body: { title: string; type: string; startsAt: string; endsAt: string },
    @Request() req: any,
  ) {
    return this.tournaments.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      type?: string;
      startsAt?: string;
      endsAt?: string;
      status?: 'upcoming' | 'active' | 'completed' | 'cancelled';
    },
    @Request() req: any,
  ) {
    return this.tournaments.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.tournaments.remove(id, req.user.tenantId);
  }

  @Post(':id/register')
  @Roles(UserRole.student)
  register(@Param('id') id: string, @Request() req: any) {
    return this.tournaments.register(id, req.user.userId);
  }

  @Get(':id/registrations')
  @Roles(
    UserRole.mentor,
    UserRole.manager,
    UserRole.filadmin,
    UserRole.superadmin,
  )
  registrations(@Param('id') id: string) {
    return this.tournaments.getRegistrations(id);
  }

  /**
   * 25.C.4: Single-elimination bracket derived from registrations.
   */
  @Get(':id/bracket')
  @Roles(
    UserRole.student,
    UserRole.mentor,
    UserRole.manager,
    UserRole.filadmin,
    UserRole.superadmin,
  )
  bracket(@Param('id') id: string) {
    return this.tournaments.getBracket(id);
  }
}
