import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TechIssuesService } from './tech-issues.service';
import { TechIssuesController } from './tech-issues.controller';

@Module({
  imports: [PrismaModule],
  providers: [TechIssuesService],
  controllers: [TechIssuesController],
  exports: [TechIssuesService],
})
export class TechIssuesModule {}
