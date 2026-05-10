import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

jest.mock('../notification.service', () => ({
  notifyTeacherChangeDecision: jest.fn().mockResolvedValue(undefined),
}));

import { submitTeacherChangeRequest, decideTeacherChangeRequest } from '../teacherChange.service';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('teacherChange.service', () => {
  describe('submitTeacherChangeRequest', () => {
    it('creates request when student has accepted appointment', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ teacherId: 'teacher-1' } as any);
      mockedPrisma.teacherChangeRequest.findFirst.mockResolvedValue(null);
      mockedPrisma.teacherChangeRequest.create.mockResolvedValue({ id: 'req-1' } as any);

      const result = await submitTeacherChangeRequest('student-1', 'reason');
      expect(result.id).toBe('req-1');
    });

    it('rejects if pending request already exists', async () => {
      mockedPrisma.appointment.findFirst.mockResolvedValue({ teacherId: 'teacher-1' } as any);
      mockedPrisma.teacherChangeRequest.findFirst.mockResolvedValue({ id: 'existing' } as any);

      await expect(submitTeacherChangeRequest('student-1', 'reason')).rejects.toThrow('already have a pending request');
    });
  });

  describe('decideTeacherChangeRequest', () => {
    it('approves a pending request', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' } as any);
      mockedPrisma.teacherChangeRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'APPROVED',
        studentId: 'student-1',
      } as any);

      const result = await decideTeacherChangeRequest('req-1', 'APPROVE', 'admin-1', 'ADMIN');
      expect(result.status).toBe('APPROVED');
    });

    it('rejects non-pending request', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'APPROVED' } as any);

      await expect(decideTeacherChangeRequest('req-1', 'DENY', 'admin-1', 'ADMIN')).rejects.toThrow('already decided');
    });

    it('rejects non-admin caller', async () => {
      mockedPrisma.teacherChangeRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'PENDING' } as any);

      await expect(decideTeacherChangeRequest('req-1', 'APPROVE', 'teacher-1', 'TEACHER')).rejects.toThrow(
        'Only admins can decide teacher change requests'
      );
    });
  });
});
