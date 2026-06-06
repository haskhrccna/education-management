import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { seedRevisionForCompletion } from './revision.service';

export const getSurahs = async () => {
  return prisma.surah.findMany({ orderBy: { number: 'asc' } });
};

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

export const getProgress = async (callerId: string, callerRole: string, studentId?: string) => {
  if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(callerRole)) {
    throw new AppError(403, 'Invalid role');
  }

  const targetId = callerRole === 'STUDENT' ? callerId : studentId;
  if (!targetId) throw new AppError(400, 'studentId query param is required');

  if (callerRole === 'TEACHER') {
    await assertTeacherCanAccessStudent(callerId, targetId);
  }

  return prisma.memorizationProgress.findMany({
    where: { userId: targetId },
    include: { surah: true },
    orderBy: { surah: { number: 'asc' } },
  });
};

export const updateProgress = async (
  teacherId: string,
  surahId: number,
  studentId: string,
  memorizedAyahs: number,
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
) => {
  await assertTeacherCanAccessStudent(teacherId, studentId);

  const surah = await prisma.surah.findUnique({ where: { id: surahId } });
  if (!surah) throw new AppError(404, 'Surah not found');

  const resolvedStatus =
    status ?? (memorizedAyahs >= surah.ayahCount ? 'COMPLETE' : memorizedAyahs > 0 ? 'IN_PROGRESS' : 'NOT_STARTED');

  // Phase 4: detect the transition into COMPLETE so we seed the first
  // SM-2 revision exactly once per surah. Re-reciting an already-complete
  // surah must NOT pile up duplicate PENDING revisions.
  const prev = await prisma.memorizationProgress.findUnique({
    where: { userId_surahId: { userId: studentId, surahId } },
    select: { status: true },
  });
  const transitionedIntoComplete = prev?.status !== 'COMPLETE' && resolvedStatus === 'COMPLETE';

  const updated = await prisma.memorizationProgress.upsert({
    where: { userId_surahId: { userId: studentId, surahId } },
    create: { userId: studentId, surahId, memorizedAyahs, status: resolvedStatus },
    update: { memorizedAyahs, status: resolvedStatus, lastRecitedAt: new Date() },
    include: { surah: true },
  });

  // Phase 4: seed the first SM-2 revision only on the transition into
  // COMPLETE. seedRevisionForCompletion is idempotent on
  // (userId, surahId, status='PENDING') and is best-effort — a failure
  // here must not bubble up and break the teacher upsert.
  if (transitionedIntoComplete) {
    try {
      await seedRevisionForCompletion(studentId, surahId);
    } catch (err) {
      // Swallow — the upsert succeeded, the revision is a side effect.
      // Logging is the caller's job; intentionally not rethrowing.
    }
  }

  return updated;
};
