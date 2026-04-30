import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DuelService } from './duel.service';
import { DuelCron } from './duel.cron';
import { ChatService } from './chat.service';
import { FriendsService } from './friends.service';
import { ChallengeService } from './challenge.service';
import { FeedEventService } from './feed-event.service';
import { SocialGateway } from './social.gateway';
import { SocialController } from './social.controller';
import { GamificationModule } from '../gamification/gamification.module';
import { WarningsModule } from '../warnings/warnings.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
    forwardRef(() => GamificationModule),
    WarningsModule,
  ],
  providers: [
    DuelService,
    ChatService,
    FriendsService,
    ChallengeService,
    FeedEventService,
    SocialGateway,
    DuelCron,
  ],
  controllers: [SocialController],
  exports: [
    DuelService,
    ChatService,
    FriendsService,
    ChallengeService,
    FeedEventService,
  ],
})
export class SocialModule {}
