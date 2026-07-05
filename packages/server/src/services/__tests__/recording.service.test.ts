import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';

jest.mock('fs/promises');

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { uploadRecording, listRecordings, reviewRecording, deleteRecording } from '../recording.service';
import { AppError } from '../../middleware/error.middleware';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('recording.service', () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so mock implementations cannot leak
    // between tests — the teacher-delete test previously passed only because
    // an appointment mock from an earlier test bled through.
    jest.resetAllMocks();
  });

  describe('uploadRecording', () => {
    it('should create recording with file move', async () => {
      mockedFs.access.mockRejectedValue(new Error('no dir'));
      mockedFs.mkdir.mockResolvedValue(undefined as any);
      mockedFs.copyFile.mockResolvedValue(undefined as any);
      mockedFs.unlink.mockResolvedValue(undefined as any);
      mockedPrisma.recording.create.mockResolvedValue({
        id: 'rec-1',
        url: '/uploads/test-file.mp3',
      } as any);

      const result = await uploadRecording('student-1', 'test-file.mp3', 1024, 'audio/mpeg', '/tmp/upload-123');
      expect(result.id).toBe('rec-1');
      expect(mockedFs.copyFile).toHaveBeenCalled();
      expect(mockedFs.unlink).toHaveBeenCalledWith('/tmp/upload-123');
    });

    it('should create recording without temp file', async () => {
      mockedFs.access.mockRejectedValue(new Error('no dir'));
      mockedFs.mkdir.mockResolvedValue(undefined as any);
      mockedPrisma.recording.create.mockResolvedValue({ id: 'rec-2' } as any);

      const result = await uploadRecording('student-1', 'file.mp3', 1024, 'audio/mpeg');
      expect(result.id).toBe('rec-2');
      expect(mockedFs.copyFile).not.toHaveBeenCalled();
    });

    it('should sanitize malicious filenames', async () => {
      mockedFs.access.mockRejectedValue(new Error('no dir'));
      mockedFs.mkdir.mockResolvedValue(undefined as any);
      mockedPrisma.recording.create.mockResolvedValue({ id: 'rec-3' } as any);

      await uploadRecording('student-1', '../../../etc/passwd', 1024, 'audio/mpeg');
      const createCall = mockedPrisma.recording.create.mock.calls[0][0] as any;
      expect(createCall.data.fileName).not.toContain('..');
    });

    it('should clean up temp file on copy failure', async () => {
      mockedFs.access.mockRejectedValue(new Error('no dir'));
      mockedFs.mkdir.mockResolvedValue(undefined as any);
      mockedFs.copyFile.mockRejectedValue(new Error('disk full'));
      mockedFs.unlink.mockResolvedValue(undefined as any);

      await expect(uploadRecording('student-1', 'file.mp3', 1024, 'audio/mpeg', '/tmp/upload-123')).rejects.toThrow(
        'Failed to process uploaded file'
      );
      expect(mockedFs.unlink).toHaveBeenCalledWith('/tmp/upload-123');
    });
  });

  describe('listRecordings', () => {
    it('should filter by studentId for students', async () => {
      mockedPrisma.recording.findMany.mockResolvedValue([]);
      await listRecordings('student-1', 'student');
      expect(mockedPrisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } })
      );
    });

    it('should return all for teachers', async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([{ studentId: 'student-1' }] as any);
      mockedPrisma.recording.findMany.mockResolvedValue([]);
      await listRecordings('teacher-1', 'TEACHER');
      expect(mockedPrisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: { in: ['student-1'] } } })
      );
    });

    it('should return empty list for teacher with no accepted students without querying recordings', async () => {
      mockedPrisma.appointment.findMany.mockResolvedValue([] as any);

      const result = await listRecordings('teacher-1', 'TEACHER');

      expect(result).toEqual([]);
      expect(mockedPrisma.recording.findMany).not.toHaveBeenCalled();
    });
  });

  describe('reviewRecording', () => {
    it('should approve recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({ id: 'rec-1', studentId: 'student-1' } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedPrisma.recording.update.mockResolvedValue({ id: 'rec-1', approvedAt: new Date() } as any);

      const result = await reviewRecording('rec-1', 'teacher-1', true, 'Good job');
      expect(result.approvedAt).toBeDefined();
    });

    it('should reject unknown recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue(null);
      await expect(reviewRecording('rec-1', 'teacher-1', true)).rejects.toThrow('Recording not found');
    });

    it('should reject reviewer without an accepted appointment with the student', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({ id: 'rec-1', studentId: 'student-1' } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(reviewRecording('rec-1', 'teacher-1', true)).rejects.toThrow(
        'No accepted appointment with this student'
      );
      expect(mockedPrisma.recording.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteRecording', () => {
    it('should allow owner student to delete', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/file.mp3',
      } as any);
      mockedFs.unlink.mockResolvedValue(undefined as any);
      mockedPrisma.recording.delete.mockResolvedValue({ id: 'rec-1' } as any);

      const result = await deleteRecording('rec-1', 'student-1', false);
      expect(result.id).toBe('rec-1');
    });

    it('should allow teacher with an accepted appointment to delete a student recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/file.mp3',
      } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedPrisma.user.findUnique.mockResolvedValue({ deletedAt: null } as any);
      mockedFs.unlink.mockResolvedValue(undefined as any);
      mockedPrisma.recording.delete.mockResolvedValue({ id: 'rec-1' } as any);

      const result = await deleteRecording('rec-1', 'teacher-1', true);
      expect(result.id).toBe('rec-1');
    });

    it('should reject teacher without an accepted appointment deleting a student recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/file.mp3',
      } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);
      mockedPrisma.user.findUnique.mockResolvedValue({ deletedAt: null } as any);

      await expect(deleteRecording('rec-1', 'teacher-1', true)).rejects.toThrow(
        'No accepted appointment with this student'
      );
      expect(mockedPrisma.recording.delete).not.toHaveBeenCalled();
      expect(mockedFs.unlink).not.toHaveBeenCalled();
    });

    it('should reject teacher deleting a soft-deleted student recording despite an appointment', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-1',
        url: '/uploads/file.mp3',
      } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedPrisma.user.findUnique.mockImplementation(
        (args: any) =>
          Promise.resolve(
            args.where.id === 'student-1' ? { deletedAt: new Date('2026-01-01') } : { deletedAt: null }
          ) as any
      );

      await expect(deleteRecording('rec-1', 'teacher-1', true)).rejects.toThrow(
        'No accepted appointment with this student'
      );
      expect(mockedPrisma.recording.delete).not.toHaveBeenCalled();
    });

    it('should reject non-owner student', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-2',
      } as any);

      await expect(deleteRecording('rec-1', 'student-1', false)).rejects.toThrow('Permission denied');
      expect(mockedPrisma.recording.delete).not.toHaveBeenCalled();
    });
  });
});
