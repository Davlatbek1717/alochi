import { Test } from '@nestjs/testing';
import { ComponentsService } from './components.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  lessonComponent: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ComponentsService', () => {
  let service: ComponentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ComponentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ComponentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('setMcq', () => {
    it('deletes existing MCQ components then creates new ones', async () => {
      mockPrisma.lessonComponent.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.lessonComponent.createMany.mockResolvedValue({ count: 1 });

      await service.setMcq('lesson-1', [
        { text: 'What is "apple"?', options: ['Olma', 'Nok', 'Uzum', 'Limon'], correct: 0 },
      ]);

      expect(mockPrisma.lessonComponent.deleteMany).toHaveBeenCalledWith({
        where: { lessonId: 'lesson-1', type: 'mcq' },
      });
      expect(mockPrisma.lessonComponent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ lessonId: 'lesson-1', type: 'mcq' }),
          ]),
        }),
      );
    });
  });

  describe('setWordOrder', () => {
    it('deletes existing word_order components then creates new ones', async () => {
      mockPrisma.lessonComponent.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.lessonComponent.createMany.mockResolvedValue({ count: 1 });

      await service.setWordOrder('lesson-1', [
        { words: ['I', 'am', 'happy'], correct: 'I am happy' },
      ]);

      expect(mockPrisma.lessonComponent.deleteMany).toHaveBeenCalledWith({
        where: { lessonId: 'lesson-1', type: 'word_order' },
      });
      expect(mockPrisma.lessonComponent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ lessonId: 'lesson-1', type: 'word_order' }),
          ]),
        }),
      );
    });
  });

  describe('getComponents', () => {
    it('returns all components for a lesson', async () => {
      const components = [
        { type: 'mcq', config: { questions: [] } },
        { type: 'word_order', config: { sentences: [] } },
      ];
      mockPrisma.lessonComponent.findMany.mockResolvedValue(components);

      const result = await service.getComponents('lesson-1');

      expect(mockPrisma.lessonComponent.findMany).toHaveBeenCalledWith({
        where: { lessonId: 'lesson-1' },
      });
      expect(result).toHaveLength(2);
    });
  });
});
