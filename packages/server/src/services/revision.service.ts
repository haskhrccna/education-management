import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export type RevisionStatus = 'PENDING' | 'COMPLETED' | 'MISSED';

/**
 * Fetch revision schedules for a user (student view: own only; teacher view: assigned students only).
 */
export const getRevisions = async (userId: string, userRole: 'STUDENT' | 'TEACHER', surahId?: number) => {
  const where: Record<string, unknown> = {};

  if (userRole === 'STUDENT') {
    where.userId = userId;
  } else if (userRole === 'TEACHER') {
    const appointments = await prisma.appointment.findMany({
      where: { teacherId: userId, status: 'ACCEPTED' },
      select: { studentId: true },
    });
    const studentIds = appointments.map((a) => a.studentId);
    if (studentIds.length === 0) return [];
    where.userId = { in: studentIds };
  }

  if (surahId) {
    where.surahId = surahId;
  }

  return await prisma.revisionSchedule.findMany({
    where,
    include: { surah: true },
    orderBy: { scheduledFor: 'asc' },
  });
};

/**
 * Teacher creates a revision session for a specific student.
 */
export const createRevision = async (teacherId: string, studentId: string, surahId: number, scheduledFor: Date) => {
  // Verify teacher-student relationship via accepted appointment
  await assertTeacherCanAccessStudent(teacherId, studentId);

  const surah = await prisma.surah.findUnique({ where: { id: surahId } });
  if (!surah) throw new AppError(404, 'Surah not found');

  return await prisma.revisionSchedule.create({
    data: { userId: studentId, surahId, scheduledFor },
    include: { surah: true },
  });
};

/**
 * Mark a revision as COMPLETED or MISSED. Anyone owning the record or a TEACHER/ADMIN can update.
 */
export const updateRevision = async (
  revisionId: string,
  callerId: string,
  callerRole: 'STUDENT' | 'TEACHER' | 'ADMIN',
  status: RevisionStatus
) => {
  if (!['COMPLETED', 'MISSED'].includes(status)) {
    throw new AppError(400, 'status must be COMPLETED or MISSED');
  }

  const revision = await prisma.revisionSchedule.findUnique({
    where: { id: revisionId },
    select: { userId: true, status: true },
  });
  if (!revision) throw new AppError(404, 'Revision not found');

  // Students can only update their own; teachers/admins can update any
  if (callerRole === 'STUDENT' && revision.userId !== callerId) {
    throw new AppError(403, 'You can only update your own revisions');
  }

  return await prisma.revisionSchedule.update({
    where: { id: revisionId },
    data: { status, notedAt: new Date() },
    include: { surah: true },
  });
};

/**
 * Delete a revision schedule entry. Teachers/admins can delete any; students only their own.
 */
export const deleteRevision = async (
  revisionId: string,
  callerId: string,
  callerRole: 'STUDENT' | 'TEACHER' | 'ADMIN'
) => {
  const revision = await prisma.revisionSchedule.findUnique({
    where: { id: revisionId },
    select: { userId: true },
  });
  if (!revision) throw new AppError(404, 'Revision not found');

  if (callerRole === 'STUDENT' && revision.userId !== callerId) {
    throw new AppError(403, 'You can only delete your own revisions');
  }

  await prisma.revisionSchedule.delete({ where: { id: revisionId } });
  return { success: true };
};

async function assertTeacherCanAccessStudent(teacherId: string, studentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
    select: { id: true },
  });
  if (!appointment) throw new AppError(403, 'No accepted appointment with this student');
}
