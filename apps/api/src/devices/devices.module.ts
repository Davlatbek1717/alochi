import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController, DevicePolicyController } from './devices.controller';
import { DeviceClientController } from './device-client.controller';
import { DeviceAuthGuard } from './device-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [DevicesController, DevicePolicyController, DeviceClientController],
  providers: [DevicesService, DeviceAuthGuard],
  exports: [DevicesService],
})
export class DevicesModule {}
