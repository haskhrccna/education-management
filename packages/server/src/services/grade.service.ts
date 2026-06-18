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

const gradeInclude = {
  surah: { select: { id: true, number: true, nameAr: true, nameEn: true } },
} as const;

export const createGrade = async (
  teacherId: string,
  studentId: string,
  surahId: number | null,
  gradeValue: string,
  type: GradeTypeInput,
  notes?: string
) => {
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.deletedAt) throw new AppError(404, 'Student not found');
  if (student.role !== 'STUDENT') throw new AppError(400, 'Target user is not a student');
  await assertTeacherCanAccessStudent(teacherId, studentId);

  // Quran-only: a non-null surahId must reference an existing Surah. We
  // don't validate null because "overall" grades (e.g. end-of-term recital)
  // intentionally skip the surah dimension.
  if (surahId !== null) {
    const surah = await prisma.surah.findUnique({ where: { id: surahId }, select: { id: true } });
    if (!surah) throw new AppError(400, 'Surah not found');
  }

  const grade = await prisma.grade.create({
    data: { teacherId, studentId, surahId, grade: gradeValue, type, notes: notes || null },
    include: { ...gradeInclude, student: { select: { firstName: true, lastName: true, email: true } } },
  });

  const { notifyNewGrade } = await import('./notification.service');
  // Surah comes from the include; fall back to Arabic display of the
  // surah number, then to a Quran-domain default if no surah was attached
  // (overall recital). Keeps the notification human-readable for the
  // email + push payloads.
  const surahName = grade.surah?.nameAr ?? (grade.surahId ? `Surah #${grade.surahId}` : 'Overall Recital');
  await notifyNewGrade(studentId, { ...grade, surahName });

  return grade;
};

export const getMyGrades = async (studentId: string) => {
  return await prisma.grade.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: gradeInclude,
  });
};

export const getStudentGrades = async (callerId: string, callerRole: string, studentId: string) => {
  if (callerRole !== 'ADMIN') {
    await assertTeacherCanAccessStudent(callerId, studentId);
  }

  return await prisma.grade.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: gradeInclude,
  });
};
