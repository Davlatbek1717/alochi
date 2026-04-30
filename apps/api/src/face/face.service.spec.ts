import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FaceService } from './face.service';
import { PrismaService } from '../prisma/prisma.service';

const mockEvents = { emit: jest.fn() };

const mockPrisma = {
  faceEmbedding: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('FaceService', () => {
  let service: FaceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FaceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();
    service = module.get(FaceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getEnrollmentStatus', () => {
    it('reports unenrolled when no active embeddings', async () => {
      mockPrisma.faceEmbedding.findMany.mockResolvedValue([]);
      const result = await service.getEnrollmentStatus('u1');
      expect(result).toEqual({
        enrolled: false,
        embeddingCount: 0,
        lastUpdated: null,
      });
    });

    it('returns enrollment count and most-recent enrolledAt', async () => {
      const t1 = new Date('2026-04-20T08:00:00Z');
      const t2 = new Date('2026-04-25T08:00:00Z');
      mockPrisma.faceEmbedding.findMany.mockResolvedValue([
        { id: 'e2', enrolledAt: t2 },
        { id: 'e1', enrolledAt: t1 },
      ]);
      const result = await service.getEnrollmentStatus('u1');
      expect(result).toEqual({
        enrolled: true,
        embeddingCount: 2,
        lastUpdated: t2,
      });
    });
  });

  describe('deactivateEnrollment', () => {
    it('soft-deletes active embeddings and returns count', async () => {
      mockPrisma.faceEmbedding.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.deactivateEnrollment('u1');
      expect(result).toEqual({ deactivated: 3 });
      expect(mockPrisma.faceEmbedding.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isActive: true },
        data: { isActive: false },
      });
    });
  });

  describe('recognition fail counter (Phase 18.6)', () => {
    it('emits face.recognition_failed_3x on 3rd consecutive fail', () => {
      service.registerRecognitionFailure('dev1', 'b1');
      service.registerRecognitionFailure('dev1', 'b1');
      expect(mockEvents.emit).not.toHaveBeenCalled();
      service.registerRecognitionFailure('dev1', 'b1');
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'face.recognition_failed_3x',
        { deviceId: 'dev1', branchId: 'b1' },
      );
    });

    it('resets counter on a successful recognition', () => {
      service.registerRecognitionFailure('dev2', 'b1');
      service.registerRecognitionFailure('dev2', 'b1');
      service.registerRecognitionSuccess('dev2');
      service.registerRecognitionFailure('dev2', 'b1');
      service.registerRecognitionFailure('dev2', 'b1');
      expect(mockEvents.emit).not.toHaveBeenCalled();
      service.registerRecognitionFailure('dev2', 'b1');
      expect(mockEvents.emit).toHaveBeenCalledTimes(1);
    });

    it('counts each device independently', () => {
      service.registerRecognitionFailure('A', 'b1');
      service.registerRecognitionFailure('A', 'b1');
      service.registerRecognitionFailure('B', 'b1');
      service.registerRecognitionFailure('B', 'b1');
      expect(mockEvents.emit).not.toHaveBeenCalled();
      service.registerRecognitionFailure('A', 'b1');
      expect(mockEvents.emit).toHaveBeenCalledTimes(1);
      service.registerRecognitionFailure('B', 'b1');
      expect(mockEvents.emit).toHaveBeenCalledTimes(2);
    });
  });
});
