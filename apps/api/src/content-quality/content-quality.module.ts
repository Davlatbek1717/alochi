import { Module } from '@nestjs/common';
import { ContentQualityService } from './content-quality.service';
import { ContentQualityController } from './content-quality.controller';

@Module({
  imports: [],
  providers: [ContentQualityService],
  controllers: [ContentQualityController],
  exports: [ContentQualityService],
})
export class ContentQualityModule {}
