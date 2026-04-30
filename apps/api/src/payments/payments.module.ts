import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentSettingsController } from './payment-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController, PaymentSettingsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
