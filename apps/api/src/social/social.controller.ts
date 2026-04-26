import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { DuelService } from './duel.service';
import { ChatService } from './chat.service';
import { FriendsService } from './friends.service';
import { ChallengeService } from './challenge.service';
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

  @Get('friends')
  getFriends(@Request() req: any) {
    return this.friends.getFriends(req.user.userId);
  }

  @Post('friends/request')
  sendFriendRequest(
    @Body() body: { friendId: string; branchId: string },
    @Request() req: any,
  ) {
    return this.friends.sendRequest(req.user.userId, body.friendId, body.branchId);
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
  createChallenge(
    @Body() body: { groupAId: string; groupBId: string; endDate: Date },
    @Request() req: any,
  ) {
    return this.challenge.create(req.user.tenantId, body.groupAId, body.groupBId, body.endDate);
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

  @Post('keywords')
  @Roles(UserRole.superadmin)
  addKeyword(@Body() body: { word: string }, @Request() req: any) {
    return this.chat.createKeyword(req.user.tenantId, body.word);
  }

  @Get('keywords')
  @Roles(UserRole.superadmin)
  getKeywords(@Request() req: any) {
    return this.chat.getKeywords(req.user.tenantId);
  }

  @Delete('keywords/:id')
  @Roles(UserRole.superadmin)
  deleteKeyword(@Param('id') id: string, @Request() req: any) {
    return this.chat.deleteKeyword(id, req.user.tenantId);
  }
}
