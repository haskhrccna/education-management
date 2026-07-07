import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { seedRevisionForCompletion } from './revision.service';
import { recordActivity, evaluateMilestones } from './gamification.service';
import { generateCertificatePDF } from './report.service';
import { logger } from '../lib/logger';

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

  // Phase 5: a teacher-recorded recitation update counts as daily
  // activity. Best-effort — the upsert is the authoritative write.
  try {
    await recordActivity(studentId);
    // Only re-evaluate when the memorization status actually changed
    // (first_surah_memorized is the relevant badge; idempotent under UNIQUE).
    if (transitionedIntoComplete) {
      await evaluateMilestones(studentId);
    }
  } catch {
    /* gamification is best-effort */
  }

  // Roadmap 2.2: this surah completing may also complete one of the
  // student's curriculum plans. Isolated in its own try/catch — a failure
  // here must not affect the certificate/gamification logic above or below.
  if (transitionedIntoComplete) {
    try {
      const { checkAndCompletePlans } = await import('./curriculum-plan.service');
      await checkAndCompletePlans(studentId);
    } catch {
      /* best-effort */
    }
  }

  // Phase 6: check if the student has now completed all 114 surahs.
  // Issue a certificate if so (idempotent: skip if one was already issued today).
  if (transitionedIntoComplete) {
    try {
      const [completeCount, total] = await Promise.all([
        prisma.memorizationProgress.count({ where: { userId: studentId, status: 'COMPLETE' } }),
        prisma.surah.count(),
      ]);
      if (completeCount >= total && total > 0) {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const alreadyIssued = await prisma.certificate.findFirst({
          where: { studentId, issuedAt: { gte: todayStart } },
          select: { id: true },
        });
        if (!alreadyIssued) {
          const pdfUrl = await generateCertificatePDF(studentId);
          await prisma.certificate.create({ data: { studentId, pdfUrl } });
          logger.info({ studentId }, 'Hifz completion certificate issued');
        }
      }
    } catch (err) {
      logger.error({ err, studentId }, 'Certificate generation failed (best-effort — upsert succeeded)');
    }
  }

  return updated;
};
