import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController, DevicePolicyController } from './devices.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DevicesController, DevicePolicyController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
