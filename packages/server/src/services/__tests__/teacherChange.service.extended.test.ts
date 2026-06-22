import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../notification.service', () => ({
  notifyTeacherChangeDecision: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../prisma/client';
import { getTeacherChangeRequests, decideTeacherChangeRequest } from '../teacherChange.service';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('teacherChange.service — extended coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTeacherChangeRequests', () => {
    it('returns student own requests for STUDENT role', async () => {
      mockedPrisma.teacherChangeRequest.findMany.mockResolvedValue([{ id: 'req-1' }] as any);

      const result = await getTeacherChangeRequests('student-1', 'STUDENT');

      expect(result).toHaveLength(1);
      expect(mockedPrisma.teacherChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } })
      );
    });

    it('returns only PENDING requests for TEACHER role', async () => {
      mockedPrisma.teacherChangeRequest.findMany.mockResolvedValue([{ id: 'req-1' }] as any);

      await getTeacherChangeRequests('teacher-1', 'TEACHER');

      expect(mockedPrisma.teacherChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { currentTeacherId: 'teacher-1', status: 'PENDING' },
        })
      );
    });

    it('returns all requests for ADMIN role without status filter', async () => {
      mockedPrisma.teacherChangeRequest.findMany.mockResolvedValue([{ id: 'req-1' }, { id: 'req-2' }] as any);

      const result = await getTeacherChangeRequests('admin-1', 'ADMIN');

      expect(result).toHaveLength(2);
      expect(mockedPrisma.teacherChangeRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('applies statusFilter for ADMIN role', async () => {
      mockedPrisma.teacherChangeRequest.findMany.mockResolvedValue([{ id: 'req-1', status: 'PENDING' }] as any);

      await getTeacherChangeRequests('admin-1', 'ADMIN', 'PENDING');

      expect(mockedPrisma.teacherChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } })
      );
    });
  });

  describe('decideTeacherChangeRequest — APPROVE with newTeacherId', () => {
    it('updates student assignedTeacherId and reassigns appointments', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        studentId: 'student-1',
      } as any);
      mockedPrisma.user.findFirst.mockResolvedValue({ id: 'teacher-2', role: 'TEACHER' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'student-1' } as any);
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 1 } as any);
      // Existing ACCEPTED appointment found after reassignment — no new one created
      mockedPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' } as any);
      mockedPrisma.teacherChangeRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'APPROVED',
        studentId: 'student-1',
      } as any);

      const result = await decideTeacherChangeRequest('req-1', 'APPROVE', 'admin-1', 'ADMIN', undefined, 'teacher-2');

      expect(result.status).toBe('APPROVED');
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assignedTeacherId: 'teacher-2' } })
      );
      expect(mockedPrisma.appointment.updateMany).toHaveBeenCalled();
      expect(mockedPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('creates a synthetic ACCEPTED appointment when none exists after reassignment', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        studentId: 'student-1',
      } as any);
      mockedPrisma.user.findFirst.mockResolvedValue({ id: 'teacher-2', role: 'TEACHER' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'student-1' } as any);
      mockedPrisma.appointment.updateMany.mockResolvedValue({ count: 0 } as any);
      mockedPrisma.appointment.findFirst.mockResolvedValue(null);
      mockedPrisma.appointment.create.mockResolvedValue({ id: 'new-appt' } as any);
      mockedPrisma.teacherChangeRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'APPROVED',
        studentId: 'student-1',
      } as any);

      await decideTeacherChangeRequest('req-1', 'APPROVE', 'admin-1', 'ADMIN', undefined, 'teacher-2');

      expect(mockedPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'student-1',
            teacherId: 'teacher-2',
            status: 'ACCEPTED',
          }),
        })
      );
    });

    it('throws 400 when newTeacherId does not reference a valid TEACHER user', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        studentId: 'student-1',
      } as any);
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        decideTeacherChangeRequest('req-1', 'APPROVE', 'admin-1', 'ADMIN', undefined, 'bad-id')
      ).rejects.toMatchObject({ statusCode: 400, message: 'Invalid teacher' });
    });

    it('denies a request and persists the admin note', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        studentId: 'student-1',
      } as any);
      mockedPrisma.teacherChangeRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'DENIED',
        studentId: 'student-1',
      } as any);

      const result = await decideTeacherChangeRequest('req-1', 'DENY', 'admin-1', 'ADMIN', 'Not validated');

      expect(result.status).toBe('DENIED');
      expect(mockedPrisma.teacherChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DENIED', adminNote: 'Not validated' }),
        })
      );
    });

    it('throws 404 when request id does not exist', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue(null);

      await expect(decideTeacherChangeRequest('ghost', 'DENY', 'admin-1', 'ADMIN')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
