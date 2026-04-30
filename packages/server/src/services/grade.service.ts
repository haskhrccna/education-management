import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

type GradeTypeInput = 'QUIZ' | 'ASSIGNMENT' | 'EXAM' | 'ORAL' | 'PARTICIPATION';

export const createGrade = async (teacherId: string, studentId: string, subject: string, gradeValue: string, type: GradeTypeInput, notes?: string) => {
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw new AppError(404, 'Student not found');
  if (student.role !== 'STUDENT') throw new AppError(400, 'Target user is not a student');

  const grade = await prisma.grade.create({
    data: { teacherId, studentId, subject, grade: gradeValue, type, notes: notes || null },
    include: { student: { select: { firstName: true, lastName: true, email: true } } },
  });

  // Notify student of new grade
  const { notifyNewGrade } = await import('./notification.service');
  await notifyNewGrade(studentId, grade);

  return grade;
};

export const getMyGrades = async (studentId: string) => {
  return await prisma.grade.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });
};

export const getStudentGrades = async (_teacherId: string, studentId: string) => {
  return await prisma.grade.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });
};
