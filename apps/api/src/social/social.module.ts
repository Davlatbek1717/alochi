import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DuelService } from './duel.service';
import { ChatService } from './chat.service';
import { FriendsService } from './friends.service';
import { ChallengeService } from './challenge.service';
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
  providers: [DuelService, ChatService, FriendsService, ChallengeService, SocialGateway],
  controllers: [SocialController],
  exports: [DuelService, ChatService, FriendsService, ChallengeService],
})
export class SocialModule {}
