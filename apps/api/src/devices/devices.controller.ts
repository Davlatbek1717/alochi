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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private svc: DevicesService) {}

  // ── Registration ──────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  create(
    @Body()
    body: {
      serialNumber: string;
      imei?: string;
      macAddress?: string;
      manufacturer?: string;
      model?: string;
      osVersion?: string;
      androidId?: string;
      purchasedAt?: string;
      branchId: string;
    },
    @Request() req: any,
  ) {
    return this.svc.create({
      ...body,
      purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : undefined,
      tenantId: req.user.tenantId,
    });
  }

  @Get()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  findAll(
    @Query('branchId') branchId: string | undefined,
    @Query('status') status: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.findAll(req.user.tenantId, branchId, status as any);
  }

  @Get(':id')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.svc.findById(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  update(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.svc.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.svc.softDelete(id, req.user.tenantId);
  }

  // ── Enrollment ────────────────────────────────────────────────────────────

  @Post(':id/enroll')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  enroll(
    @Param('id') id: string,
    @Body() body: { studentId: string },
    @Request() req: any,
  ) {
    return this.svc.enroll(id, req.user.tenantId, body.studentId, req.user.userId);
  }

  @Post(':id/unenroll')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  unenroll(@Param('id') id: string, @Request() req: any) {
    return this.svc.unenroll(id, req.user.tenantId);
  }

  // ── Health ────────────────────────────────────────────────────────────────

  @Post(':id/health')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  submitHealth(
    @Param('id') id: string,
    @Body()
    body: {
      batteryLevel?: number;
      storageFreePct?: number;
      networkType?: string;
      signalStrength?: number;
      appVersion?: string;
    },
    @Request() req: any,
  ) {
    return this.svc.submitHealthPing(id, req.user.tenantId, body);
  }

  @Get(':id/health')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  getHealth(@Param('id') id: string, @Request() req: any) {
    return this.svc.getRecentHealth(id, req.user.tenantId);
  }

  @Get(':id/policy')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  getDevicePolicy(@Param('id') id: string, @Request() req: any) {
    return this.svc.getPolicyForDevice(id, req.user.tenantId);
  }

  // ── Events ────────────────────────────────────────────────────────────────

  @Post(':id/events')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  submitEvents(
    @Param('id') id: string,
    @Body()
    body: {
      events: Array<{
        type: string;
        severity?: string;
        payload?: unknown;
        occurredAt: string;
      }>;
    },
    @Request() req: any,
  ) {
    return this.svc.submitEvents(
      id,
      req.user.tenantId,
      body.events.map((e) => ({ ...e, occurredAt: new Date(e.occurredAt) })),
    );
  }

  @Get(':id/events')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  getEvents(
    @Param('id') id: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('type') type: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.getEvents(id, req.user.tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id/timeline')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  getTimeline(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    return this.svc.getEvents(id, req.user.tenantId, {
      limit: limit ? parseInt(limit, 10) : 200,
    });
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  @Post(':id/commands')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  issueCommand(
    @Param('id') id: string,
    @Body() body: { type: string; payload?: unknown },
    @Request() req: any,
  ) {
    return this.svc.issueCommand(id, req.user.tenantId, body.type, body.payload, req.user.userId);
  }

  @Get(':id/commands')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  getCommands(@Param('id') id: string, @Request() req: any) {
    return this.svc.getPendingCommands(id, req.user.tenantId);
  }

  @Patch(':id/commands/:cmdId')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  updateCommandStatus(
    @Param('id') id: string,
    @Param('cmdId') cmdId: string,
    @Body() body: { status: string; resultPayload?: unknown },
    @Request() req: any,
  ) {
    return this.svc.updateCommandStatus(
      id,
      req.user.tenantId,
      cmdId,
      body.status,
      body.resultPayload,
    );
  }

  @Delete(':id/commands/:cmdId')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  cancelCommand(
    @Param('id') id: string,
    @Param('cmdId') cmdId: string,
    @Request() req: any,
  ) {
    return this.svc.cancelCommand(id, req.user.tenantId, cmdId);
  }
}

// ── Policy controller ────────────────────────────────────────────────────────

import { Controller as _Ctrl } from '@nestjs/common';

@ApiTags('device-policy')
@ApiBearerAuth()
@_Ctrl('branches/:branchId/device-policy')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicePolicyController {
  constructor(private svc: DevicesService) {}

  @Get()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  get(@Param('branchId') branchId: string) {
    return this.svc.getPolicy(branchId);
  }

  @Patch()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  upsert(@Param('branchId') branchId: string, @Body() body: any) {
    return this.svc.upsertPolicy(branchId, body);
  }
}
