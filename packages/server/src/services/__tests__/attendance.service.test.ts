import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Mock the services notifyUser dynamically imports.
jest.mock('../../services/socket.service', () => ({ sendToUser: jest.fn() }));
jest.mock('../../services/email.service', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/fcm.service', () => ({ sendPushToUser: jest.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../prisma/client';
import { recordAttendance, getStudentAttendance } from '../attendance.service';
import { AppError } from '../../middleware/error.middleware';

const m = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('attendance.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Run transaction callbacks with a deep-mocked Prisma client so that the
    // `tx.sessionRecord.create` and `tx.appointment.update` calls inside
    // recordAttendance resolve against the same mocked prisma instance.
    m.$transaction.mockImplementation(async (fn: any) => fn(m));
  });

  describe('recordAttendance', () => {
    const baseAppointment = {
      id: 'apt-1',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      status: 'ACCEPTED' as const,
    };

    it('rejects an invalid status enum value', async () => {
      await expect(recordAttendance('apt-1', 'teacher-1', 'FOO' as any)).rejects.toBeInstanceOf(AppError);
      expect(m.sessionRecord.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the appointment does not exist', async () => {
      m.appointment.findUnique.mockResolvedValue(null);

      await expect(recordAttendance('missing', 'teacher-1', 'PRESENT')).rejects.toThrow('Appointment not found');
    });

    it('rejects when the caller is not the teacher for this appointment', async () => {
      m.appointment.findUnique.mockResolvedValue({ ...baseAppointment, teacherId: 'other-teacher' } as any);

      await expect(recordAttendance('apt-1', 'teacher-1', 'PRESENT')).rejects.toThrow(
        'You are not the teacher for this appointment'
      );
      expect(m.sessionRecord.create).not.toHaveBeenCalled();
    });

    it('rejects when no accepted appointment with the student exists', async () => {
      m.appointment.findUnique.mockResolvedValue(baseAppointment as any);
      m.appointment.findFirst.mockResolvedValue(null); // guard fails
      m.user.findUnique.mockResolvedValue({ deletedAt: null } as any);

      await expect(recordAttendance('apt-1', 'teacher-1', 'PRESENT')).rejects.toThrow(
        'No accepted appointment with this student'
      );
    });

    it('rejects a second attendance record for the same appointment (double-record)', async () => {
      m.appointment.findUnique.mockResolvedValue(baseAppointment as any);
      m.appointment.findFirst.mockResolvedValue({ id: 'apt-2' } as any);
      m.user.findUnique.mockResolvedValue({ deletedAt: null } as any);
      m.sessionRecord.findUnique.mockResolvedValue({ id: 'existing' } as any);

      await expect(recordAttendance('apt-1', 'teacher-1', 'PRESENT')).rejects.toThrow(
        'Attendance has already been recorded for this appointment'
      );
      expect(m.sessionRecord.create).not.toHaveBeenCalled();
    });

    it('creates the SessionRecord AND flips the Appointment to COMPLETED in one transaction', async () => {
      m.appointment.findUnique.mockResolvedValue(baseAppointment as any);
      m.appointment.findFirst.mockResolvedValue({ id: 'apt-2' } as any);
      m.user.findUnique.mockResolvedValue({ deletedAt: null } as any);
      m.sessionRecord.findUnique.mockResolvedValue(null);
      m.sessionRecord.create.mockResolvedValue({
        id: 'sr-1',
        appointmentId: 'apt-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
        status: 'PRESENT',
        notes: 'Great recitation',
        recordedAt: new Date(),
        appointment: { requestedDate: new Date('2026-06-10'), requestedTime: '10:00' },
      } as any);

      const result = await recordAttendance('apt-1', 'teacher-1', 'PRESENT', 'Great recitation');

      // The transaction callback was invoked exactly once with both writes
      expect(m.$transaction).toHaveBeenCalledTimes(1);
      expect(m.sessionRecord.create).toHaveBeenCalledWith({
        data: {
          appointmentId: 'apt-1',
          studentId: 'student-1',
          teacherId: 'teacher-1',
          status: 'PRESENT',
          notes: 'Great recitation',
        },
        include: { appointment: { select: { requestedDate: true, requestedTime: true } } },
      });
      expect(m.appointment.update).toHaveBeenCalledWith({
        where: { id: 'apt-1' },
        data: { status: 'COMPLETED' },
      });
      expect(result.id).toBe('sr-1');
    });

    it('persists a Phase-1 Notification row for the student', async () => {
      m.appointment.findUnique.mockResolvedValue(baseAppointment as any);
      m.appointment.findFirst.mockResolvedValue({ id: 'apt-2' } as any);
      m.user.findUnique.mockResolvedValue({ deletedAt: null } as any);
      m.sessionRecord.findUnique.mockResolvedValue(null);
      m.sessionRecord.create.mockResolvedValue({
        id: 'sr-1',
        appointmentId: 'apt-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
        status: 'LATE',
        notes: null,
        recordedAt: new Date(),
        appointment: { requestedDate: new Date('2026-06-10'), requestedTime: '10:00' },
      } as any);

      await recordAttendance('apt-1', 'teacher-1', 'LATE');

      expect(m.notification.create).toHaveBeenCalledTimes(1);
      const arg = m.notification.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        userId: 'student-1',
        type: 'attendance_recorded',
      });
      expect(arg.data.title).toMatch(/Late/);
    });
  });

  describe('getStudentAttendance', () => {
    it('lets a student read their own attendance', async () => {
      m.sessionRecord.findMany.mockResolvedValue([{ id: 'sr-1' }] as any);

      await getStudentAttendance('student-1', 'STUDENT', 'student-1');

      expect(m.sessionRecord.findMany).toHaveBeenCalledWith({
        where: { studentId: 'student-1' },
        orderBy: { recordedAt: 'desc' },
        include: {
          appointment: { select: { requestedDate: true, requestedTime: true, durationMinutes: true } },
        },
      });
    });

    it("rejects a student reading another student's attendance", async () => {
      await expect(getStudentAttendance('student-1', 'STUDENT', 'student-2')).rejects.toThrow(
        'You can only view your own attendance'
      );
      expect(m.sessionRecord.findMany).not.toHaveBeenCalled();
    });

    it('requires an accepted appointment for a teacher to read', async () => {
      m.appointment.findFirst.mockResolvedValue(null);
      m.user.findUnique.mockResolvedValue({ deletedAt: null } as any);

      await expect(getStudentAttendance('teacher-1', 'TEACHER', 'student-1')).rejects.toThrow(
        'No accepted appointment with this student'
      );
    });

    it('lets an admin read any student without a guard check', async () => {
      m.sessionRecord.findMany.mockResolvedValue([{ id: 'sr-1' }] as any);

      await getStudentAttendance('admin-1', 'ADMIN', 'student-1');

      expect(m.appointment.findFirst).not.toHaveBeenCalled();
      expect(m.sessionRecord.findMany).toHaveBeenCalled();
    });
  });
});
