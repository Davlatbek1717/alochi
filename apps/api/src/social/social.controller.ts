import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DuelService } from './duel.service';
import { ChatService } from './chat.service';
import { FriendsService } from './friends.service';
import { ChallengeService } from './challenge.service';
import { FeedEventService } from './feed-event.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('social')
@ApiBearerAuth()
@Controller('social')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SocialController {
  constructor(
    private duel: DuelService,
    private chat: ChatService,
    private friends: FriendsService,
    private challenge: ChallengeService,
    private feedEvent: FeedEventService,
  ) {}

  @Post('duels')
  createDuel(@Body() body: { challengedId: string }, @Request() req: any) {
    return this.duel.create(
      req.user.userId,
      body.challengedId,
      req.user.tenantId,
    );
  }

  @Post('duels/:id/answer')
  submitDuelAnswer(
    @Param('id') id: string,
    @Body() body: { questionIdx: number; answer: number; answerMs?: number },
    @Request() req: any,
  ) {
    return this.duel.submitAnswer(
      id,
      req.user.userId,
      body.questionIdx,
      body.answer,
      body.answerMs,
    );
  }

  @Patch('duels/:id/respond')
  respondToDuel(
    @Param('id') id: string,
    @Body() body: { accept: boolean },
    @Request() req: any,
  ) {
    return this.duel.respond(id, req.user.userId, body.accept);
  }

  @Get('duels')
  listDuels(@Request() req: any) {
    return this.duel.listDuels(req.user.userId);
  }

  @Get('duels/:id')
  getDuel(@Param('id') id: string, @Request() req: any) {
    return this.duel.getDuel(id, req.user.userId);
  }

  @Get('groups/:groupId/messages')
  getGroupMessages(@Param('groupId') groupId: string, @Request() req: any) {
    return this.chat.getGroupMessages(groupId, {
      actor: { role: req?.user?.role, branchId: req?.user?.branchId ?? null },
    });
  }

  /**
   * REST parity with WebSocket `chat:send`. Both paths funnel into
   * `chatService.sendMessage`. Useful for clients that don't keep a WS
   * connection open (e.g. SSR bots, scripted tests).
   */
  @Post('groups/:groupId/messages')
  @Roles(UserRole.student, UserRole.mentor, UserRole.filadmin)
  sendGroupMessage(
    @Param('groupId') groupId: string,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.chat.sendMessage({
      tenantId: req.user.tenantId,
      groupId,
      senderId: req.user.userId,
      content: body.content,
    });
  }

  @Post('groups/:groupId/messages/:messageId/pin')
  @Roles(UserRole.mentor, UserRole.filadmin, UserRole.superadmin)
  pinMessage(@Param('messageId') messageId: string, @Request() req: any) {
    return this.chat.pinMessage(messageId, req.user.userId);
  }

  @Post('messages/:id/approve')
  @Roles(UserRole.mentor, UserRole.filadmin, UserRole.superadmin)
  approveMessage(@Param('id') messageId: string, @Request() req: any) {
    return this.chat.approveMessage(messageId, req.user.userId);
  }

  @Post('messages/:id/reject')
  @Roles(UserRole.mentor, UserRole.filadmin, UserRole.superadmin)
  rejectMessage(@Param('id') messageId: string, @Request() req: any) {
    return this.chat.rejectMessage(messageId, req.user.userId);
  }

  @Post('branches/:id/lock')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  toggleBranchChatLock(
    @Param('id') id: string,
    @Body() body: { locked: boolean },
  ) {
    return this.chat.setBranchChatLocked(id, body.locked);
  }

  @Delete('groups/:groupId/messages/:msgId')
  @Roles(UserRole.mentor, UserRole.filadmin, UserRole.superadmin)
  deleteGroupMessage(@Param('msgId') msgId: string, @Request() req: any) {
    return this.chat.deleteMessage(msgId, req.user.userId);
  }

  @Post('groups/:groupId/ban/:studentId')
  @Roles(UserRole.mentor, UserRole.filadmin, UserRole.superadmin)
  banStudent(
    @Param('studentId') studentId: string,
    @Body() body: { reason?: string; hours?: number },
    @Request() req: any,
  ) {
    if (studentId === req.user.userId)
      throw new ForbiddenException("O'zingizni ban qila olmaysiz");
    const expiresAt = body.hours
      ? new Date(Date.now() + body.hours * 3_600_000)
      : new Date(Date.now() + 24 * 3_600_000);
    return this.chat.banUser(
      studentId,
      req.user.userId,
      body.reason ?? 'Moderator tomonidan',
      expiresAt,
    );
  }

  @Post('messages/:id/react')
  addReaction(
    @Param('id') messageId: string,
    @Body() body: { emoji: string },
    @Request() req: any,
  ) {
    return this.chat.addReaction(messageId, req.user.userId, body.emoji);
  }

  @Get('friends')
  getFriends(@Request() req: any) {
    return this.friends.getFriends(req.user.userId);
  }

  @Post('friends/request')
  sendFriendRequest(
    @Body() body: { friendId: string; scope?: 'group' | 'branch' },
    @Request() req: any,
  ) {
    return this.friends.sendRequest(
      req.user.userId,
      body.friendId,
      body.scope ?? 'branch',
    );
  }

  @Post('friends/:id/respond')
  respondToRequest(
    @Param('id') id: string,
    @Body() body: { accept: boolean },
    @Request() req: any,
  ) {
    return this.friends.respond(id, req.user.userId, body.accept);
  }

  @Get('friends/pending')
  getPendingRequests(@Request() req: any) {
    return this.friends.getPendingRequests(req.user.userId);
  }

  @Post('challenges')
  @Roles(UserRole.mentor, UserRole.filadmin, UserRole.superadmin)
  createChallenge(
    @Body() body: { groupAId: string; groupBId: string; endDate: Date },
    @Request() req: any,
  ) {
    return this.challenge.create(
      req.user.tenantId,
      body.groupAId,
      body.groupBId,
      body.endDate,
    );
  }

  @Get('challenges/active/:groupId')
  getActiveChallenge(@Param('groupId') groupId: string) {
    return this.challenge.getActiveForGroup(groupId);
  }

  @Get('feed')
  @Roles(UserRole.student)
  getFeed(@Request() req: any) {
    return this.friends.getFeed(req.user.userId, req.user.tenantId);
  }

  @Post('feed/:id/react')
  feedReact(
    @Param('id') eventId: string,
    @Body() body: { emoji: string },
    @Request() req: any,
  ) {
    return this.feedEvent.addReaction(eventId, req.user.userId, body.emoji);
  }
}
