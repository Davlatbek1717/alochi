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
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { UpsertDevicePolicyDto } from './dto/upsert-device-policy.dto';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private svc: DevicesService) {}

  // ── Registration ──────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.filadmin, UserRole.superadmin)
  create(@Body() dto: CreateDeviceDto, @Request() req: any) {
    return this.svc.create({
      serialNumber: dto.serialNumber,
      branchId: dto.branchId,
      imei: dto.imei,
      macAddress: dto.macAddress,
      manufacturer: dto.manufacturer,
      model: dto.model,
      osVersion: dto.osVersion,
      androidId: dto.androidId,
      purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
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
    @Body() dto: UpdateDeviceDto,
    @Request() req: any,
  ) {
    return this.svc.update(id, req.user.tenantId, dto);
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
    return this.svc.enroll(
      id,
      req.user.tenantId,
      body.studentId,
      req.user.userId,
    );
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
    return this.svc.issueCommand(
      id,
      req.user.tenantId,
      body.type,
      body.payload,
      req.user.userId,
    );
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

  // ── Remote control (block / unblock / locate) ─────────────────────────────

  @Post(':id/block')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  block(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.svc.setBlocked(
      id,
      req.user.tenantId,
      true,
      body?.reason,
      req.user.userId,
    );
  }

  @Post(':id/unblock')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  unblock(@Param('id') id: string, @Request() req: any) {
    return this.svc.setBlocked(
      id,
      req.user.tenantId,
      false,
      undefined,
      req.user.userId,
    );
  }

  @Post(':id/locate')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  locate(@Param('id') id: string, @Request() req: any) {
    return this.svc.issueLocate(id, req.user.tenantId, req.user.userId);
  }

  @Post(':id/message')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  message(
    @Param('id') id: string,
    @Body() body: { text: string },
    @Request() req: any,
  ) {
    return this.svc.issueCommand(
      id,
      req.user.tenantId,
      'MESSAGE',
      { text: body?.text ?? '' },
      req.user.userId,
    );
  }

  @Post(':id/ring')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  ring(@Param('id') id: string, @Request() req: any) {
    return this.svc.issueCommand(
      id,
      req.user.tenantId,
      'RING',
      undefined,
      req.user.userId,
    );
  }

  // Device-owner only on the tablet side; arrives via heartbeat/FCM.
  @Post(':id/reboot')
  @Roles(UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  reboot(@Param('id') id: string, @Request() req: any) {
    return this.svc.issueCommand(
      id,
      req.user.tenantId,
      'REBOOT',
      undefined,
      req.user.userId,
    );
  }

  @Post(':id/wipe')
  @Roles(UserRole.superadmin)
  @HttpCode(HttpStatus.OK)
  wipe(@Param('id') id: string, @Request() req: any) {
    return this.svc.issueWipeCommand(
      id,
      req.user.tenantId,
      'WIPE_USER_DATA',
      undefined,
      req.user.userId,
    );
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
  upsert(
    @Param('branchId') branchId: string,
    @Body() dto: UpsertDevicePolicyDto,
  ) {
    return this.svc.upsertPolicy(branchId, dto);
  }
}
