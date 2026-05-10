import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { getRevisions, createRevision, updateRevision, deleteRevision } from '../revision.service';

const m = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('revision.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getRevisions', () => {
    it('should return only own revisions for students', async () => {
      m.revisionSchedule.findMany.mockResolvedValue([]);

      await getRevisions('student-1', 'STUDENT');

      expect(m.revisionSchedule.findMany).toHaveBeenCalledWith({
        where: { userId: 'student-1' },
        include: { surah: true },
        orderBy: { scheduledFor: 'asc' },
      });
    });

    it('should return revisions for teacher assigned students', async () => {
      m.appointment.findMany.mockResolvedValue([{ studentId: 'student-1' }] as any);
      m.revisionSchedule.findMany.mockResolvedValue([]);

      await getRevisions('teacher-1', 'TEACHER');

      expect(m.revisionSchedule.findMany).toHaveBeenCalledWith({
        where: { userId: { in: ['student-1'] } },
        include: { surah: true },
        orderBy: { scheduledFor: 'asc' },
      });
    });

    it('should filter by surahId when provided', async () => {
      m.revisionSchedule.findMany.mockResolvedValue([]);

      await getRevisions('student-1', 'STUDENT', 5);

      expect(m.revisionSchedule.findMany).toHaveBeenCalledWith({
        where: { userId: 'student-1', surahId: 5 },
        include: { surah: true },
        orderBy: { scheduledFor: 'asc' },
      });
    });
  });

  describe('createRevision', () => {
    it('should reject without accepted appointment', async () => {
      m.appointment.findFirst.mockResolvedValue(null);

      await expect(createRevision('teacher-1', 'student-1', 5, new Date())).rejects.toThrow(
        'No accepted appointment with this student'
      );
      expect(m.revisionSchedule.create).not.toHaveBeenCalled();
    });

    it('should reject when surah not found', async () => {
      m.appointment.findFirst.mockResolvedValue({ id: 'apt-1' } as any);
      m.surah.findUnique.mockResolvedValue(null);

      await expect(createRevision('teacher-1', 'student-1', 999, new Date())).rejects.toThrow('Surah not found');
    });

    it('should create a revision schedule entry', async () => {
      m.appointment.findFirst.mockResolvedValue({ id: 'apt-1' } as any);
      m.surah.findUnique.mockResolvedValue({ id: 5, number: 5, name: 'Al-Baqarah' } as any);
      m.revisionSchedule.create.mockResolvedValue({
        id: 'rev-1',
        userId: 'student-1',
        surahId: 5,
        scheduledFor: new Date(),
        status: 'PENDING',
      } as any);

      const result = await createRevision('teacher-1', 'student-1', 5, new Date('2026-05-15T10:00:00Z'));

      expect(result.surahId).toBe(5);
      expect(m.revisionSchedule.create).toHaveBeenCalledWith({
        data: { userId: 'student-1', surahId: 5, scheduledFor: new Date('2026-05-15T10:00:00Z') },
        include: { surah: true },
      });
    });
  });

  describe('updateRevision', () => {
    it('should reject invalid status', async () => {
      await expect(updateRevision('rev-1', 'student-1', 'STUDENT', 'PENDING')).rejects.toThrow(
        'status must be COMPLETED or MISSED'
      );
    });

    it('should reject student updating another student revision', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({ userId: 'student-2', status: 'PENDING' } as any);

      await expect(updateRevision('rev-1', 'student-1', 'STUDENT', 'COMPLETED')).rejects.toThrow(
        'You can only update your own revisions'
      );
    });

    it('should allow student to mark their own revision as completed', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({ userId: 'student-1', status: 'PENDING' } as any);
      m.revisionSchedule.update.mockResolvedValue({
        id: 'rev-1',
        userId: 'student-1',
        surahId: 5,
        scheduledFor: new Date(),
        status: 'COMPLETED',
        notedAt: new Date(),
      } as any);

      const result = await updateRevision('rev-1', 'student-1', 'STUDENT', 'COMPLETED');

      expect(result.status).toBe('COMPLETED');
      expect(result.notedAt).toBeDefined();
    });

    it('should allow teacher to mark any student revision as completed', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({ userId: 'student-1', status: 'PENDING' } as any);
      m.revisionSchedule.update.mockResolvedValue({
        id: 'rev-1',
        userId: 'student-1',
        surahId: 5,
        scheduledFor: new Date(),
        status: 'MISSED',
        notedAt: new Date(),
      } as any);

      const result = await updateRevision('rev-1', 'teacher-1', 'TEACHER', 'MISSED');

      expect(result.status).toBe('MISSED');
    });
  });

  describe('deleteRevision', () => {
    it('should reject student deleting another student revision', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({ userId: 'student-2' } as any);

      await expect(deleteRevision('rev-1', 'student-1', 'STUDENT')).rejects.toThrow(
        'You can only delete your own revisions'
      );
    });

    it('should allow student to delete their own revision', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({ userId: 'student-1' } as any);
      m.revisionSchedule.delete.mockResolvedValue({ id: 'rev-1' } as any);

      const result = await deleteRevision('rev-1', 'student-1', 'STUDENT');

      expect(result.success).toBe(true);
      expect(m.revisionSchedule.delete).toHaveBeenCalledWith({ where: { id: 'rev-1' } });
    });

    it('should allow teacher to delete any revision', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({ userId: 'student-1' } as any);
      m.revisionSchedule.delete.mockResolvedValue({ id: 'rev-1' } as any);

      const result = await deleteRevision('rev-1', 'teacher-1', 'TEACHER');

      expect(result.success).toBe(true);
    });
  });
});
