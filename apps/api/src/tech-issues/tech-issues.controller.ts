import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TechIssuesService } from './tech-issues.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('tech-issues')
@ApiBearerAuth()
@Controller('tech-issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TechIssuesController {
  constructor(private issues: TechIssuesService) {}

  @Post()
  @Roles(
    UserRole.tester,
    UserRole.mentor,
    UserRole.manager,
    UserRole.filadmin,
    UserRole.superadmin,
  )
  create(
    @Body()
    body: {
      category: string;
      description: string;
      severity?: string;
    },
    @Request() req: any,
  ) {
    return this.issues.create({
      tenantId: req.user.tenantId,
      branchId: req.user.branchId ?? null,
      reportedBy: req.user.userId,
      category: body.category,
      description: body.description,
      severity: body.severity,
    });
  }

  @Get()
  @Roles(UserRole.filadmin, UserRole.superadmin, UserRole.tester)
  list(@Query('status') status: string | undefined, @Request() req: any) {
    return this.issues.list(req.user.tenantId, { status });
  }

  @Patch(':id/resolve')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  resolve(@Param('id') id: string, @Body('resolution') resolution: string) {
    return this.issues.resolve(id, resolution);
  }
}
