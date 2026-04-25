import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DuelService } from './duel.service';
import { ChatService } from './chat.service';
import { SocialGateway } from './social.gateway';
import { SocialController } from './social.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
  ],
  providers: [DuelService, ChatService, SocialGateway],
  controllers: [SocialController],
  exports: [DuelService, ChatService],
})
export class SocialModule {}
