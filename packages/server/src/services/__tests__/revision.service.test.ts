import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import {
  getRevisions,
  createRevision,
  updateRevision,
  deleteRevision,
  seedRevisionForCompletion,
} from '../revision.service';

// Phase 4: updateRevision now calls notifyUser inline. Stub the downstream
// services it dynamically imports so the test doesn't need a real
// socket/email/push pipeline.
jest.mock('../../services/socket.service', () => ({ sendToUser: jest.fn() }));
jest.mock('../../services/email.service', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/fcm.service', () => ({ sendPushToUser: jest.fn().mockResolvedValue(undefined) }));

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

  // ─── Phase 4: SM-2 spaced-repetition engine ────────────────────────────

  describe('seedRevisionForCompletion', () => {
    it('returns the existing PENDING revision (idempotent) without creating a duplicate', async () => {
      m.revisionSchedule.findFirst.mockResolvedValue({ id: 'existing-1' } as any);

      const result = await seedRevisionForCompletion('student-1', 5);

      expect(result).toEqual({ id: 'existing-1' });
      expect(m.revisionSchedule.create).not.toHaveBeenCalled();
    });

    it('creates a new PENDING revision scheduled 1 day out when none is outstanding', async () => {
      m.revisionSchedule.findFirst.mockResolvedValue(null);
      m.revisionSchedule.create.mockResolvedValue({ id: 'new-1' } as any);

      const result = await seedRevisionForCompletion('student-1', 5);

      expect(result).toEqual({ id: 'new-1' });
      expect(m.revisionSchedule.create).toHaveBeenCalledTimes(1);
      const call = m.revisionSchedule.create.mock.calls[0][0];
      expect(call.data).toMatchObject({
        userId: 'student-1',
        surahId: 5,
        status: 'PENDING',
      });
      // scheduledFor must be roughly +1 day from now (allow a 2s jitter)
      const scheduledFor = call.data.scheduledFor as Date;
      const diffMs = scheduledFor.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000); // > 23h
      expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000); // < 25h
    });
  });

  describe('getRevisions (Phase 4: opts.due filter)', () => {
    it('with opts.due adds status=PENDING and scheduledFor<=now to the where', async () => {
      m.revisionSchedule.findMany.mockResolvedValue([]);

      await getRevisions('student-1', 'STUDENT', undefined, { due: true });

      expect(m.revisionSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'student-1',
            status: 'PENDING',
            scheduledFor: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        })
      );
    });

    it('without opts.due, the where has no status or scheduledFor filter', async () => {
      m.revisionSchedule.findMany.mockResolvedValue([]);

      await getRevisions('student-1', 'STUDENT');

      const calls = m.revisionSchedule.findMany.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const call = calls[0][0] as { where: Record<string, unknown> };
      expect(call.where).not.toHaveProperty('status');
      expect(call.where).not.toHaveProperty('scheduledFor');
    });
  });

  describe('updateRevision (Phase 4: SM-2 recompute on close)', () => {
    it('after marking COMPLETED, creates a NEXT revision with interval=6 (2nd-success SM-2 step)', async () => {
      // First card: repetitions 1, interval 1, easeFactor 2.5
      m.revisionSchedule.findUnique.mockResolvedValue({
        userId: 'student-1',
        status: 'PENDING',
        surahId: 5,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 1,
      } as any);
      m.revisionSchedule.update.mockResolvedValue({ id: 'rev-1', status: 'COMPLETED' } as any);
      m.revisionSchedule.create.mockResolvedValue({ id: 'rev-2' } as any);

      await updateRevision('rev-1', 'student-1', 'STUDENT', 'COMPLETED');

      // The newly created card: repetitions=2, interval=6
      // easeFactor: quality 4 → delta 0.0 → easeFactor stays at 2.5
      const createCall = m.revisionSchedule.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        userId: 'student-1',
        surahId: 5,
        status: 'PENDING',
        interval: 6,
        repetitions: 2,
      });
      expect(createCall.data.easeFactor).toBeCloseTo(2.5, 1);
    });

    it('after marking MISSED, the next card is reset to interval=1, repetitions=0', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({
        userId: 'student-1',
        status: 'PENDING',
        surahId: 5,
        interval: 15,
        easeFactor: 2.6,
        repetitions: 4,
      } as any);
      m.revisionSchedule.update.mockResolvedValue({ id: 'rev-1', status: 'MISSED' } as any);
      m.revisionSchedule.create.mockResolvedValue({ id: 'rev-2' } as any);

      await updateRevision('rev-1', 'student-1', 'STUDENT', 'MISSED');

      const createCall = m.revisionSchedule.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        status: 'PENDING',
        interval: 1,
        repetitions: 0,
      });
    });

    it('persists a notification (best-effort) when a revision is closed', async () => {
      m.revisionSchedule.findUnique.mockResolvedValue({
        userId: 'student-1',
        status: 'PENDING',
        surahId: 5,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
      } as any);
      m.revisionSchedule.update.mockResolvedValue({ id: 'rev-1', status: 'COMPLETED' } as any);
      m.revisionSchedule.create.mockResolvedValue({ id: 'rev-2' } as any);
      // notification.service.notifyUser falls through to prisma.notification.create

      await updateRevision('rev-1', 'student-1', 'STUDENT', 'COMPLETED');

      expect(m.notification.create).toHaveBeenCalledTimes(1);
      expect(m.notification.create.mock.calls[0][0].data.type).toBe('revision_completed');
    });
  });
});
