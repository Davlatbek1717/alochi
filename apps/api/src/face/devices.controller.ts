import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { DevicesService } from './devices.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private devices: DevicesService) {}

  @Post('register')
  register(@Body() body: { branchId: string; deviceName: string }) {
    return this.devices.register(body.branchId, body.deviceName);
  }

  @Get(':branchId')
  listForBranch(@Param('branchId') branchId: string) {
    return this.devices.listForBranch(branchId);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.devices.deactivate(id);
  }
}
