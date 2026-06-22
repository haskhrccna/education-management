import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../revision.service', () => ({
  seedRevisionForCompletion: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../gamification.service', () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined),
  evaluateMilestones: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../prisma/client';
import { getSurahs, getProgress, updateProgress } from '../memorization.service';
import * as revisionService from '../revision.service';
import * as gamificationService from '../gamification.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedRevision = revisionService as jest.Mocked<typeof revisionService>;
const mockedGamification = gamificationService as jest.Mocked<typeof gamificationService>;

describe('memorization.service — extended coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSurahs', () => {
    it('returns all surahs ordered by number ascending', async () => {
      mockedPrisma.surah.findMany.mockResolvedValue([
        { id: 1, number: 1, nameAr: 'الفاتحة', nameEn: 'Al-Fatiha' },
      ] as any);

      const result = await getSurahs();

      expect(result).toHaveLength(1);
      expect(mockedPrisma.surah.findMany).toHaveBeenCalledWith({ orderBy: { number: 'asc' } });
    });
  });

  describe('getProgress — ADMIN and error cases', () => {
    it('lets admin read any student progress without appointment check', async () => {
      mockedPrisma.memorizationProgress.findMany.mockResolvedValue([{ surahId: 1 }] as any);

      const result = await getProgress('admin-1', 'ADMIN', 'student-1');

      expect(result).toHaveLength(1);
      expect(mockedPrisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    it('throws 400 when ADMIN provides no studentId', async () => {
      await expect(getProgress('admin-1', 'ADMIN', undefined)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('throws 403 for unsupported role', async () => {
      await expect(getProgress('parent-1', 'PARENT', 'student-1')).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('updateProgress — happy paths', () => {
    function mockAccess() {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce({ deletedAt: null } as any)
        .mockResolvedValueOnce({ deletedAt: null } as any);
    }

    const surah = { id: 1, ayahCount: 7 };

    it('upserts progress and records gamification activity', async () => {
      mockAccess();
      mockedPrisma.surah.findUnique.mockResolvedValue(surah as any);
      mockedPrisma.memorizationProgress.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
        surahId: 1,
        status: 'IN_PROGRESS',
        memorizedAyahs: 3,
        surah,
      } as any);

      await updateProgress('teacher-1', 1, 'student-1', 3);

      expect(mockedPrisma.memorizationProgress.upsert).toHaveBeenCalled();
      expect(mockedGamification.recordActivity).toHaveBeenCalledWith('student-1');
    });

    it('seeds SM-2 revision only on the first transition to COMPLETE', async () => {
      mockAccess();
      mockedPrisma.surah.findUnique.mockResolvedValue(surah as any);
      mockedPrisma.memorizationProgress.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
        surahId: 1,
        status: 'COMPLETE',
        memorizedAyahs: 7,
        surah,
      } as any);

      await updateProgress('teacher-1', 1, 'student-1', 7);

      expect(mockedRevision.seedRevisionForCompletion).toHaveBeenCalledWith('student-1', 1);
      expect(mockedGamification.evaluateMilestones).toHaveBeenCalledWith('student-1');
    });

    it('does NOT re-seed revision when surah was already COMPLETE', async () => {
      mockAccess();
      mockedPrisma.surah.findUnique.mockResolvedValue(surah as any);
      mockedPrisma.memorizationProgress.findUnique.mockResolvedValue({ status: 'COMPLETE' } as any);
      mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
        surahId: 1,
        status: 'COMPLETE',
        memorizedAyahs: 7,
        surah,
      } as any);

      await updateProgress('teacher-1', 1, 'student-1', 7);

      expect(mockedRevision.seedRevisionForCompletion).not.toHaveBeenCalled();
    });

    it('auto-resolves status to COMPLETE when memorizedAyahs >= ayahCount', async () => {
      mockAccess();
      mockedPrisma.surah.findUnique.mockResolvedValue(surah as any);
      mockedPrisma.memorizationProgress.findUnique.mockResolvedValue({ status: 'NOT_STARTED' } as any);
      mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
        surahId: 1,
        status: 'COMPLETE',
        surah,
      } as any);

      await updateProgress('teacher-1', 1, 'student-1', 7);

      expect(mockedPrisma.memorizationProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'COMPLETE' }),
          update: expect.objectContaining({ status: 'COMPLETE' }),
        })
      );
    });

    it('auto-resolves status to IN_PROGRESS for partial completion', async () => {
      mockAccess();
      mockedPrisma.surah.findUnique.mockResolvedValue(surah as any);
      mockedPrisma.memorizationProgress.findUnique.mockResolvedValue({ status: 'NOT_STARTED' } as any);
      mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
        surahId: 1,
        status: 'IN_PROGRESS',
        surah,
      } as any);

      await updateProgress('teacher-1', 1, 'student-1', 3);

      expect(mockedPrisma.memorizationProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'IN_PROGRESS' }),
        })
      );
    });

    it('throws 404 when surah does not exist', async () => {
      mockAccess();
      mockedPrisma.surah.findUnique.mockResolvedValue(null);

      await expect(updateProgress('teacher-1', 999, 'student-1', 3)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Surah not found',
      });
    });

    it('survives gamification failure without throwing (best-effort)', async () => {
      mockAccess();
      mockedPrisma.surah.findUnique.mockResolvedValue(surah as any);
      mockedPrisma.memorizationProgress.findUnique.mockResolvedValue({ status: 'NOT_STARTED' } as any);
      mockedPrisma.memorizationProgress.upsert.mockResolvedValue({
        surahId: 1,
        status: 'IN_PROGRESS',
        surah,
      } as any);
      mockedGamification.recordActivity.mockRejectedValue(new Error('Redis down'));

      await expect(updateProgress('teacher-1', 1, 'student-1', 2)).resolves.toBeDefined();
    });
  });
});
