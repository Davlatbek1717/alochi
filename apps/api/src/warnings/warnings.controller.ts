import { Controller, Post, Delete, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WarningsService } from './warnings.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('warnings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarningsController {
  constructor(private warnings: WarningsService) {}

  @Post()
  @Roles(UserRole.filadmin, UserRole.manager)
  give(@Body() body: any, @Request() req: any) {
    return this.warnings.give({ ...body, tenantId: req.user.tenantId, givenBy: req.user.userId });
  }

  @Delete(':id')
  @Roles(UserRole.filadmin, UserRole.manager)
  cancel(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    return this.warnings.cancel(id, req.user.userId, reason);
  }

  @Get('student/:studentId')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.mentor)
  getByStudent(@Param('studentId') studentId: string) {
    return this.warnings.findByStudent(studentId);
  }
}
