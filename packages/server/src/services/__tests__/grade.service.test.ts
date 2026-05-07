import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { createGrade, getMyGrades, getStudentGrades } from '../grade.service';
import { AppError } from '../../middleware/error.middleware';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('grade.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGrade', () => {
    it('should create grade for valid student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' } as any);
      mockedPrisma.grade.create.mockResolvedValue({
        id: 'grade-1',
        studentId: 'student-1',
        teacherId: 'teacher-1',
        subject: 'Math',
        grade: '95',
        type: 'EXAM',
      } as any);

      const result = await createGrade('teacher-1', 'student-1', 'Math', '95', 'EXAM', 'Good work');
      expect(result.id).toBe('grade-1');
    });

    it('should reject non-existent student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      await expect(createGrade('teacher-1', 'unknown', 'Math', '95', 'EXAM')).rejects.toThrow('Student not found');
    });

    it('should reject non-student target', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' } as any);
      await expect(createGrade('teacher-1', 'teacher-1', 'Math', '95', 'EXAM')).rejects.toThrow(
        'Target user is not a student'
      );
    });
  });

  describe('getMyGrades', () => {
    it('should return grades for student', async () => {
      mockedPrisma.grade.findMany.mockResolvedValue([{ id: 'grade-1', subject: 'Math' }] as any);
      const result = await getMyGrades('student-1');
      expect(result).toHaveLength(1);
      expect(mockedPrisma.grade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } })
      );
    });
  });

  describe('getStudentGrades', () => {
    it('should return grades for any student', async () => {
      mockedPrisma.grade.findMany.mockResolvedValue([{ id: 'grade-1' }] as any);
      const result = await getStudentGrades('teacher-1', 'student-1');
      expect(result).toHaveLength(1);
    });
  });
});
