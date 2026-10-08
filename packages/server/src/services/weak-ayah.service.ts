import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

async function assertTeacherCanAccessStudent(teacherId: string, studentId: string) {
  // Matches the other six copies of this guard: an ACCEPTED appointment is not
  // enough on its own, because a soft-deleted student keeps their appointments.
  // Deleted teachers are already rejected at auth.middleware.ts, but nothing
  // stopped a teacher writing against a deleted student through this path.
  const [appointment, teacher, student] = await Promise.all([
    prisma.appointment.findFirst({ where: { teacherId, studentId, status: 'ACCEPTED' }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: teacherId }, select: { deletedAt: true } }),
    prisma.user.findUnique({ where: { id: studentId }, select: { deletedAt: true } }),
  ]);
  if (!appointment || teacher?.deletedAt || student?.deletedAt) {
    throw new AppError(403, 'No accepted appointment with this student');
  }
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
export const listWeakAyahFlags = async (userId: string, userRole: string) => {
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
  } else if (userRole !== 'ADMIN') {
    // Deny by default: any other role (PARENT) used to get every student's flags.
    throw new AppError(403, 'Not allowed to list weak-ayah flags');
  }

  return prisma.weakAyahFlag.findMany({
    where,
    include: { ayah: { select: { id: true, number: true, surahId: true, text: true } } },
    orderBy: { createdAt: 'desc' },
  });
};
