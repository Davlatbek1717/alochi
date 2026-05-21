import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrivacyService } from './privacy.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  // ── Consent ───────────────────────────────────────────────────────────────

  @Post('consent')
  grantConsent(
    @Request() req: any,
    @Body() body: { consentType: string },
  ) {
    return this.privacyService.grantConsent(
      req.user.userId,
      req.user.tenantId,
      body.consentType,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Delete('consent/:type')
  revokeConsent(@Request() req: any, @Param('type') type: string) {
    return this.privacyService.revokeConsent(req.user.userId, req.user.tenantId, type);
  }

  @Get('consent/my')
  getMyConsents(@Request() req: any) {
    return this.privacyService.getMyConsents(req.user.userId, req.user.tenantId);
  }

  @Get('consent/student/:studentId')
  getStudentConsents(@Request() req: any, @Param('studentId') studentId: string) {
    return this.privacyService.getStudentConsents(studentId, req.user.tenantId);
  }

  // ── Data export ───────────────────────────────────────────────────────────

  @Get('users/me/export')
  exportMyData(@Request() req: any) {
    return this.privacyService.exportUserData(req.user.userId, req.user.tenantId);
  }

  // ── Deletion requests ─────────────────────────────────────────────────────

  @Post('users/me/delete-request')
  requestDeletion(@Request() req: any) {
    return this.privacyService.requestDeletion(req.user.userId);
  }

  @Get('users/me/delete-status')
  getDeletionStatus(@Request() req: any) {
    return this.privacyService.getDeletionStatus(req.user.userId);
  }

  @Post('users/me/delete-cancel')
  cancelDeletion(@Request() req: any, @Body('reason') reason?: string) {
    return this.privacyService.cancelDeletion(req.user.userId, reason);
  }

  @Post('admin/deletion-requests/:id/approve')
  approveDeletion(@Request() req: any, @Param('id') id: string) {
    return this.privacyService.approveDeletion(id, req.user.userId);
  }
}
