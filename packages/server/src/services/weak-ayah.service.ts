import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

async function assertTeacherCanAccessStudent(teacherId: string, studentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
    select: { id: true },
  });
  if (!appointment) throw new AppError(403, 'No accepted appointment with this student');
}

/**
 * Flag an ayah as weak for a student — manually by a teacher, or
 * automatically (flaggedByTeacherId omitted) once 1.1's accuracy scoring
 * can attribute a low score to a specific ayah. Idempotent: an already-ACTIVE
 * flag for this (student, ayah) pair is returned as-is rather than duplicated.
 *
 * Seeds the first drill card through the same SM-2 defaults every revision
 * starts with — no new spaced-repetition algorithm.
 */
export const flagWeakAyah = async (studentId: string, ayahId: number, flaggedByTeacherId?: string) => {
  if (flaggedByTeacherId) {
    await assertTeacherCanAccessStudent(flaggedByTeacherId, studentId);
  }

  const ayah = await prisma.ayah.findUnique({ where: { id: ayahId }, select: { id: true, surahId: true } });
  if (!ayah) throw new AppError(404, 'Ayah not found');

  const existing = await prisma.weakAyahFlag.findFirst({ where: { studentId, ayahId, status: 'ACTIVE' } });
  if (existing) return existing;

  const flag = await prisma.weakAyahFlag.create({
    data: { studentId, ayahId, flaggedByTeacherId: flaggedByTeacherId ?? null },
  });

  const scheduledFor = new Date();
  scheduledFor.setUTCDate(scheduledFor.getUTCDate() + 1);
  await prisma.revisionSchedule.create({
    data: { userId: studentId, surahId: ayah.surahId, ayahId, scheduledFor, status: 'PENDING' },
  });

  return flag;
};

/** A teacher's flagged-weak ayahs for their own students; a student sees only their own; admin sees all. */
export const listWeakAyahFlags = async (userId: string, userRole: 'STUDENT' | 'TEACHER' | 'ADMIN') => {
  let where: Record<string, unknown> = { status: 'ACTIVE' };

  if (userRole === 'STUDENT') {
    where = { ...where, studentId: userId };
  } else if (userRole === 'TEACHER') {
    const appointments = await prisma.appointment.findMany({
      where: { teacherId: userId, status: 'ACCEPTED' },
      select: { studentId: true },
    });
    const studentIds = appointments.map((a) => a.studentId);
    if (studentIds.length === 0) return [];
    where = { ...where, studentId: { in: studentIds } };
  }

  return prisma.weakAyahFlag.findMany({
    where,
    include: { ayah: { select: { id: true, number: true, surahId: true, text: true } } },
    orderBy: { createdAt: 'desc' },
  });
};
