import {
  Controller,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceAuthGuard } from './device-auth.guard';

interface DeviceReq {
  device: { id: string; tenantId: string; branchId: string };
}

/**
 * Device-facing API — called by the Android kiosk app, authenticated by the
 * per-device enrollment token (DeviceAuthGuard), NOT a user JWT. Kept on a
 * separate `/device-api` path from the admin `/devices` endpoints.
 */
@Controller('device-api')
@UseGuards(DeviceAuthGuard)
export class DeviceClientController {
  constructor(private svc: DevicesService) {}

  /** Periodic heartbeat: health + GPS in, block-state + commands out. */
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(
    @Body()
    body: {
      batteryLevel?: number;
      storageFreePct?: number;
      networkType?: string;
      signalStrength?: number;
      appVersion?: string;
      latitude?: number;
      longitude?: number;
      foregroundApp?: string;
      fcmToken?: string;
      model?: string;
      manufacturer?: string;
      osVersion?: string;
    },
    @Request() req: DeviceReq,
  ) {
    return this.svc.deviceHeartbeat(req.device.id, body);
  }

  /** Tamper / security events (accessibility off, app uninstalled, SIM change...). */
  @Post('events')
  @HttpCode(HttpStatus.OK)
  events(
    @Body()
    body: {
      events: Array<{
        type: string;
        severity?: string;
        payload?: unknown;
        occurredAt?: string;
      }>;
    },
    @Request() req: DeviceReq,
  ) {
    const events = (body.events ?? []).map((e) => ({
      type: e.type,
      severity: e.severity,
      payload: e.payload,
      occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
    }));
    return this.svc.deviceSubmitEvents(req.device.id, req.device.tenantId, events);
  }

  /** Device acknowledges / completes a command it executed. */
  @Post('commands/:cmdId/ack')
  @HttpCode(HttpStatus.OK)
  ackCommand(
    @Param('cmdId') cmdId: string,
    @Body() body: { status: string; resultPayload?: unknown },
    @Request() req: DeviceReq,
  ) {
    return this.svc.ackCommandByDevice(
      req.device.id,
      cmdId,
      body.status,
      body.resultPayload,
    );
  }
}
