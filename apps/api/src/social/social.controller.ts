import {
  Controller, Get, Post, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DuelService } from './duel.service';
import { ChatService } from './chat.service';

@Controller('social')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(
    private duel: DuelService,
    private chat: ChatService,
  ) {}

  @Post('duels')
  createDuel(
    @Body() body: { challengedId: string },
    @Request() req: any,
  ) {
    return this.duel.create(req.user.userId, body.challengedId, req.user.tenantId);
  }

  @Post('duels/:id/answer')
  submitDuelAnswer(
    @Param('id') id: string,
    @Body() body: { questionIdx: number; answer: number },
    @Request() req: any,
  ) {
    return this.duel.submitAnswer(id, req.user.userId, body.questionIdx, body.answer);
  }

  @Get('duels/:id/result')
  getDuelResult(@Param('id') id: string) {
    return this.duel.getResult(id);
  }

  @Get('groups/:groupId/messages')
  getGroupMessages(@Param('groupId') groupId: string) {
    return this.chat.getGroupMessages(groupId);
  }

  @Post('messages/:id/react')
  addReaction(
    @Param('id') messageId: string,
    @Body() body: { emoji: string },
    @Request() req: any,
  ) {
    return this.chat.addReaction(messageId, req.user.userId, body.emoji);
  }
}
