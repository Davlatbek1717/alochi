import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DuelService } from './duel.service';

@Injectable()
export class DuelCron {
  constructor(private duel: DuelService) {}

  @Cron('*/5 * * * *')
  async handleExpiry() {
    await this.duel.expireOverdue();
  }
}
