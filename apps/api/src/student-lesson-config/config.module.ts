import { Module } from '@nestjs/common';
import { StudentConfigService } from './config.service';
import { StudentConfigController } from './config.controller';

@Module({
  providers: [StudentConfigService],
  controllers: [StudentConfigController],
  exports: [StudentConfigService],
})
export class StudentConfigModule {}
