import { Test } from '@nestjs/testing';
import { LetterCollectionService } from './letter-collection.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  letter: { findMany: jest.fn(), findUnique: jest.fn() },
  studentLetter: { findMany: jest.fn(), create: jest.fn() },
};

describe('LetterCollectionService', () => {
  let service: LetterCollectionService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LetterCollectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = moduleRef.get(LetterCollectionService);
  });

  afterEach(() => jest.clearAllMocks());

  it('listOwned returns owned flag for each letter', async () => {
    mockPrisma.letter.findMany.mockResolvedValue([
      { id: 'l-A', char: 'A' },
      { id: 'l-B', char: 'B' },
    ]);
    mockPrisma.studentLetter.findMany.mockResolvedValue([
      { letterId: 'l-A', earnedAt: new Date('2026-01-01') },
    ]);

    const result = await service.listOwned('s-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ char: 'A', owned: true });
    expect(result[1]).toMatchObject({ char: 'B', owned: false });
  });

  it('awardRandom returns null when all letters are owned', async () => {
    mockPrisma.studentLetter.findMany.mockResolvedValue([{ letterId: 'l-A' }]);
    mockPrisma.letter.findMany.mockResolvedValue([{ id: 'l-A' }]);

    const result = await service.awardRandom('s-1');
    expect(result).toBeNull();
  });

  it('awardRandom picks an unowned letter and creates a StudentLetter row', async () => {
    mockPrisma.studentLetter.findMany.mockResolvedValue([{ letterId: 'l-A' }]);
    mockPrisma.letter.findMany.mockResolvedValue([
      { id: 'l-A' },
      { id: 'l-B' },
    ]);
    mockPrisma.studentLetter.create.mockResolvedValue({ id: 'sl-1' });
    mockPrisma.letter.findUnique.mockResolvedValue({ id: 'l-B', char: 'B' });

    const result = await service.awardRandom('s-1');
    expect(mockPrisma.studentLetter.create).toHaveBeenCalledWith({
      data: { studentId: 's-1', letterId: 'l-B' },
    });
    expect(result).toMatchObject({ id: 'l-B' });
  });
});
