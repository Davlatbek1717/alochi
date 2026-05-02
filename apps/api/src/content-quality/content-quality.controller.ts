import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ContentQualityService } from './content-quality.service';

@ApiTags('content-quality')
@ApiBearerAuth()
@Controller('content-quality')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentQualityController {
  constructor(private cq: ContentQualityService) {}

  @Get('lessons')
  @Roles(UserRole.superadmin)
  getLessons(@Request() req: any) {
    return this.cq.getLessonStats(req.user.tenantId);
  }

  @Post('feedback')
  @Roles(UserRole.student)
  submitFeedback(
    @Request() req: any,
    @Body() body: { lessonId: string; rating: number },
  ) {
    return this.cq.submitFeedback(req.user.userId, body.lessonId, body.rating);
  }

  @Post('lessons/:id/variant')
  @Roles(UserRole.superadmin)
  createVariant(
    @Param('id') id: string,
    @Body() body: { config: object },
    @Request() req: any,
  ) {
    return this.cq.createVariant(id, body.config, req.user.tenantId);
  }

  @Get('lessons/:id/ab-results')
  @Roles(UserRole.superadmin)
  getABResults(@Param('id') id: string, @Request() req: any) {
    return this.cq.getABResults(id, req.user.tenantId);
  }

  /**
   * Student-facing — returns the caller's stable variant assignment
   * for a lesson, or null when the lesson has no active variants.
   * Stable = the first call assigns randomly and the assignment is
   * persisted, every subsequent call for the same student+lesson
   * returns the same row. This is what makes A/B observable: the
   * same student always sees the same variant for the duration of
   * the test.
   */
  @Get('lessons/:id/my-variant')
  @Roles(UserRole.student)
  getMyVariant(@Param('id') id: string, @Request() req: any) {
    return this.cq.getVariantPayloadForStudent(req.user.userId, id);
  }

  @Post('lessons/:id/promote/:variant')
  @Roles(UserRole.superadmin)
  promoteVariant(
    @Param('id') id: string,
    @Param('variant') variant: 'A' | 'B',
    @Request() req: any,
  ) {
    return this.cq.promoteVariant(id, variant, req.user.tenantId);
  }
}
