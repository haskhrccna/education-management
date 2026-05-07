import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../socket.service', () => ({
  sendToUser: jest.fn(),
}));

import { prisma } from '../../prisma/client';
import {
  listUsers,
  createTeacher,
  approveStudent,
  deactivateUser,
  getTeacherProgress,
  getStudentProgress,
  broadcastMessage,
} from '../admin.service';
import { AppError } from '../../middleware/error.middleware';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('admin.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should list all users without filter', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }] as any);
      const result = await listUsers();
      expect(result).toHaveLength(1);
      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } })
      );
    });

    it('should filter by role', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', role: 'STUDENT' }] as any);
      await listUsers('student');
      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, role: 'STUDENT' } })
      );
    });
  });

  describe('createTeacher', () => {
    it('should create teacher with ACTIVE status', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.user.create.mockResolvedValue({
        id: 'teacher-1',
        email: 'teacher@test.com',
        role: 'TEACHER',
        status: 'ACTIVE',
      } as any);

      const result = await createTeacher('teacher@test.com', 'Password123!', 'John', 'Doe');
      expect(result.status).toBe('ACTIVE');
      expect(mockedPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });

    it('should reject duplicate email', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'existing' } as any);
      await expect(createTeacher('existing@test.com', 'Password123!', 'John', 'Doe')).rejects.toThrow(
        'Email already registered'
      );
    });
  });

  describe('approveStudent', () => {
    it('should activate student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'student-1', status: 'ACTIVE' } as any);

      const result = await approveStudent('student-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('should reject non-student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' } as any);
      await expect(approveStudent('teacher-1')).rejects.toThrow('User is not a student');
    });

    it('should reject unknown user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      await expect(approveStudent('unknown')).rejects.toThrow('Student not found');
    });
  });

  describe('deactivateUser', () => {
    it('should ban user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'BANNED' } as any);

      const result = await deactivateUser('user-1');
      expect(result.status).toBe('BANNED');
    });

    it('should reject unknown user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      await expect(deactivateUser('unknown')).rejects.toThrow('User not found');
    });
  });

  describe('getTeacherProgress', () => {
    it('should calculate average grade correctly', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'teacher-1',
          email: 't@test.com',
          firstName: 'T',
          lastName: 'T',
          appointmentsAsTeacher: [{ id: 'a1' }],
          gradesGiven: [{ grade: '90' }, { grade: '100' }],
        },
      ] as any);

      const result = await getTeacherProgress();
      expect(Array.isArray(result)).toBe(true);
      expect((result as any[])[0]).toMatchObject({
        acceptedAppointments: 1,
        gradesGiven: 2,
        averageGrade: 95,
      });
    });

    it('should handle non-numeric grades gracefully', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'teacher-1',
          email: 't@test.com',
          firstName: 'T',
          lastName: 'T',
          appointmentsAsTeacher: [],
          gradesGiven: [{ grade: 'A+' }, { grade: '85' }],
        },
      ] as any);

      const result = await getTeacherProgress();
      expect(Array.isArray(result)).toBe(true);
      expect((result as any[])[0].averageGrade).toBe(85);
    });
  });

  describe('getStudentProgress', () => {
    it('should return student stats', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([
        {
          id: 'student-1',
          email: 's@test.com',
          firstName: 'S',
          lastName: 'S',
          gradesReceived: [{ grade: '80' }],
          appointmentsAsStudent: [{ id: 'a1' }],
        },
      ] as any);

      const result = await getStudentProgress();
      expect(Array.isArray(result)).toBe(true);
      expect((result as any[])[0]).toMatchObject({
        gradesReceived: 1,
        acceptedAppointments: 1,
        averageGrade: 80,
      });
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast to all users', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }] as any);

      const result = await broadcastMessage('Hello everyone');
      expect(result.recipients).toBe(2);
    });

    it('should filter by role', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'student-1' }] as any);

      await broadcastMessage('Hello students', 'student');
      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'STUDENT' } }));
    });
  });
});
