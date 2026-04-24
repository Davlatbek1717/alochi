import { Module } from '@nestjs/common';
import { WarningsService } from './warnings.service';
import { WarningsController } from './warnings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WarningsController],
  providers: [WarningsService],
  exports: [WarningsService],
})
export class WarningsModule {}
