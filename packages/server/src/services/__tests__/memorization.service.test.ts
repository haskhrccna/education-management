import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { getProgress, updateProgress } from '../memorization.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('memorization.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProgress', () => {
    it('should let students read their own progress', async () => {
      mockedPrisma.memorizationProgress.findMany.mockResolvedValue([{ surahId: 1 }] as any);

      const result = await getProgress('student-1', 'STUDENT');

      expect(result).toHaveLength(1);
      expect(mockedPrisma.memorizationProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'student-1' } })
      );
      expect(mockedPrisma.appointment.findFirst).not.toHaveBeenCalled();
    });

    it('should let teachers read assigned student progress', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appointment-1' } as any);
      mockedPrisma.memorizationProgress.findMany.mockResolvedValue([{ surahId: 1 }] as any);

      const result = await getProgress('teacher-1', 'TEACHER', 'student-1');

      expect(result).toHaveLength(1);
      expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { teacherId: 'teacher-1', studentId: 'student-1', status: 'ACCEPTED' },
        select: { id: true },
      });
    });

    it('should reject teacher access to unassigned student progress', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(getProgress('teacher-1', 'TEACHER', 'student-1')).rejects.toThrow(
        'No accepted appointment with this student'
      );
      expect(mockedPrisma.memorizationProgress.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateProgress', () => {
    it('should reject progress updates without an accepted appointment', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(updateProgress('teacher-1', 1, 'student-1', 3)).rejects.toThrow(
        'No accepted appointment with this student'
      );
      expect(mockedPrisma.memorizationProgress.upsert).not.toHaveBeenCalled();
    });
  });
});
