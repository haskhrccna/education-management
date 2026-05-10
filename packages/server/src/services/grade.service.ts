import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

type GradeTypeInput = 'QUIZ' | 'ASSIGNMENT' | 'EXAM' | 'ORAL' | 'PARTICIPATION';

async function assertTeacherCanAccessStudent(teacherId: string, studentId: string) {
  const [appointment, teacher, student] = await Promise.all([
    prisma.appointment.findFirst({ where: { teacherId, studentId, status: 'ACCEPTED' }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: teacherId }, select: { deletedAt: true } }),
    prisma.user.findUnique({ where: { id: studentId }, select: { deletedAt: true } }),
  ]);
  if (!appointment || teacher?.deletedAt || student?.deletedAt) {
    throw new AppError(403, 'No accepted appointment with this student');
  }
}

export const createGrade = async (
  teacherId: string,
  studentId: string,
  subject: string,
  gradeValue: string,
  type: GradeTypeInput,
  notes?: string
) => {
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.deletedAt) throw new AppError(404, 'Student not found');
  if (student.role !== 'STUDENT') throw new AppError(400, 'Target user is not a student');
  await assertTeacherCanAccessStudent(teacherId, studentId);

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

export const getStudentGrades = async (callerId: string, callerRole: string, studentId: string) => {
  if (callerRole !== 'ADMIN') {
    await assertTeacherCanAccessStudent(callerId, studentId);
  }

  return await prisma.grade.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });
};
