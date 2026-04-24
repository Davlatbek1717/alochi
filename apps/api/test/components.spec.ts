import { ComponentsService } from '../src/lessons/components.service';

describe('ComponentsService', () => {
  const mockPrisma = {
    lessonComponent: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([
        { type: 'mcq', config: { questions: [] } },
      ]),
    },
  };

  beforeEach(() => jest.clearAllMocks());

  const service = new ComponentsService(mockPrisma as any);

  it('saves MCQ questions for a lesson', async () => {
    await service.setMcq('lesson-id', [
      { text: 'What is "apple"?', options: ['Olma', 'Nok', 'Uzum', 'Limon'], correct: 0 },
    ]);
    expect(mockPrisma.lessonComponent.createMany).toHaveBeenCalled();
  });

  it('returns lesson components', async () => {
    const result = await service.getComponents('lesson-id');
    expect(result).toHaveLength(1);
  });
});
