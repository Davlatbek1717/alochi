import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const QUEST_TEMPLATES = [
  { questType: 'learn_words', targetValue: 3 },
  { questType: 'watch_video', targetValue: 1 },
  { questType: 'ask_tutor', targetValue: 3 },
  { questType: 'lesson_complete', targetValue: 1 },
] as const;

@Injectable()
export class QuestService {
  constructor(private prisma: PrismaService) {}

  async generateDailyQuests(studentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.dailyQuest.findMany({
      where: { studentId, date: today },
    });
    if (existing.length > 0) return existing;

    const shuffled = [...QUEST_TEMPLATES]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    return Promise.all(
      shuffled.map((template) =>
        this.prisma.dailyQuest.create({
          data: { studentId, date: today, ...template },
        }),
      ),
    );
  }

  async updateProgress(studentId: string, questType: string, increment = 1) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const quest = await this.prisma.dailyQuest.findFirst({
      where: { studentId, date: today, questType, completed: false },
    });

    if (!quest) return null;

    const newProgress = quest.progress + increment;
    const completed = newProgress >= quest.targetValue;

    return this.prisma.dailyQuest.update({
      where: { id: quest.id },
      data: { progress: newProgress, completed },
    });
  }

  async getTodayQuests(studentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const quests = await this.prisma.dailyQuest.findMany({
      where: { studentId, date: today },
    });

    if (quests.length === 0) return this.generateDailyQuests(studentId);
    return quests;
  }
}
