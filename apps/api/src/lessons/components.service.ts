import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface McqQuestion {
  text: string;
  options: string[];
  correct: number;
}

interface WordOrderSentence {
  words: string[];
  correct: string;
}

@Injectable()
export class ComponentsService {
  constructor(private prisma: PrismaService) {}

  async setMcq(lessonId: string, questions: McqQuestion[]) {
    await this.prisma.lessonComponent.deleteMany({ where: { lessonId, type: 'mcq' } });
    return this.prisma.lessonComponent.createMany({
      data: [{ lessonId, type: 'mcq', config: { questions } as any }],
    });
  }

  async setWordOrder(lessonId: string, sentences: WordOrderSentence[]) {
    await this.prisma.lessonComponent.deleteMany({ where: { lessonId, type: 'word_order' } });
    return this.prisma.lessonComponent.createMany({
      data: [{ lessonId, type: 'word_order', config: { sentences } as any }],
    });
  }

  async setVocabulary(lessonId: string, words: { uzbek: string; english: string }[]) {
    await this.prisma.lessonComponent.deleteMany({ where: { lessonId, type: 'vocabulary' } });
    return this.prisma.lessonComponent.createMany({
      data: [{ lessonId, type: 'vocabulary', config: { words } as any }],
    });
  }

  async getComponents(lessonId: string) {
    return this.prisma.lessonComponent.findMany({ where: { lessonId } });
  }
}
