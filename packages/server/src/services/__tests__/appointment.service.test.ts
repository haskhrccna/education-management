import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { createAppointment, manageAppointment } from '../appointment.service';
import { AppError } from '../../middleware/error.middleware';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('appointment.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn(mockedPrisma);
    });
  });

  describe('createAppointment', () => {
    it('should create appointment when no conflicts exist', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'teacher-1',
        role: 'TEACHER',
      } as any);
      mockedPrisma.appointment.findMany.mockResolvedValue([]);
      mockedPrisma.appointment.create.mockResolvedValue({
        id: 'appt-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
      } as any);

      const result = await createAppointment('student-1', 'teacher-1', '2025-01-15', '10:00', 60);

      expect(result.id).toBe('appt-1');
      expect(mockedPrisma.appointment.create).toHaveBeenCalled();
    });

    it('should reject invalid teacher', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(createAppointment('student-1', 'invalid', '2025-01-15', '10:00', 60)).rejects.toThrow(AppError);
    });

    it('should reject overlapping appointments', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' } as any);
      mockedPrisma.appointment.findMany.mockResolvedValue([
        { id: 'existing', requestedTime: '09:30', durationMinutes: 60, status: 'ACCEPTED' },
      ] as any);

      await expect(createAppointment('student-1', 'teacher-1', '2025-01-15', '10:00', 60)).rejects.toThrow(
        'overlapping'
      );
    });

    it('should allow non-overlapping same-day appointments', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' } as any);
      mockedPrisma.appointment.findMany.mockResolvedValue([
        { id: 'existing', requestedTime: '09:00', durationMinutes: 60, status: 'ACCEPTED' },
      ] as any);
      mockedPrisma.appointment.create.mockResolvedValue({ id: 'appt-2' } as any);

      const result = await createAppointment('student-1', 'teacher-1', '2025-01-15', '14:00', 60);
      expect(result.id).toBe('appt-2');
    });
  });

  describe('manageAppointment', () => {
    it('should allow teacher to manage their own appointment', async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        teacherId: 'teacher-1',
        studentId: 'student-1',
      } as any);
      mockedPrisma.appointment.update.mockResolvedValue({ id: 'appt-1', status: 'ACCEPTED' } as any);

      const result = await manageAppointment('appt-1', 'teacher-1', 'TEACHER', 'ACCEPTED');
      expect(result.status).toBe('ACCEPTED');
    });

    it('should reject teacher managing another appointment', async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        teacherId: 'teacher-2',
      } as any);

      await expect(manageAppointment('appt-1', 'teacher-1', 'TEACHER', 'ACCEPTED')).rejects.toThrow(
        'only manage your own'
      );
    });

    it('should allow admin to manage any appointment', async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        teacherId: 'teacher-2',
        studentId: 'student-1',
      } as any);
      mockedPrisma.appointment.update.mockResolvedValue({ id: 'appt-1', status: 'REJECTED' } as any);

      const result = await manageAppointment('appt-1', 'admin-1', 'ADMIN', 'REJECTED');
      expect(result.status).toBe('REJECTED');
    });
  });
});
