import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyUser } from './notification.service';

export type RevisionStatus = 'PENDING' | 'COMPLETED' | 'MISSED';

/**
 * Quality grade passed to SM-2 when a student/teacher closes a revision card.
 *  0–2: failed (resets the card)
 *  3:   recalled with serious difficulty
 *  4:   recalled with some effort
 *  5:   perfect recall
 */
export type RevisionQuality = 0 | 1 | 2 | 3 | 4 | 5;

interface Sm2State {
  interval: number;
  easeFactor: number;
  repetitions: number;
}

/**
 * SM-2 — the SuperMemo 2 algorithm. Pure, side-effect free, easy to unit test.
 *
 * See https://super-memory.com/english/ol/sm2.htm for the original paper.
 *
 * Rules:
 *  - quality < 3 → reset: repetitions=0, interval=1, easeFactor unchanged
 *                   (we still let easeFactor decay a little, mirroring SM-2
 *                   for repeated lapses, but clamp at 1.3)
 *  - quality >= 3 → repetitions += 1
 *      repetitions == 1 → interval = 1
 *      repetitions == 2 → interval = 6
 *      repetitions >  2 → interval = round(prev.interval * prev.easeFactor)
 *  - easeFactor = max(1.3, prev + (0.1 − (5−q)·(0.08 + (5−q)·0.02)))
 */
export function computeSm2(prev: Sm2State, quality: RevisionQuality): Sm2State {
  // easeFactor update is applied to both branches (the formula handles both)
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const nextEase = Math.max(1.3, prev.easeFactor + delta);

  if (quality < 3) {
    return { repetitions: 0, interval: 1, easeFactor: nextEase };
  }

  const repetitions = prev.repetitions + 1;
  let interval: number;
  if (repetitions === 1) interval = 1;
  else if (repetitions === 2) interval = 6;
  else interval = Math.round(prev.interval * prev.easeFactor);

  return { repetitions, interval, easeFactor: nextEase };
}

/**
 * Seed the first revision for a freshly-memorized surah.
 *
 * Idempotent on (userId, surahId, status='PENDING'): if a PENDING revision
 * already exists for this pair we leave it alone, so re-reciting a
 * complete surah does not pile up duplicates.
 *
 * Best-effort — throws are caught and logged by the caller (memorization
 * upsert must not fail just because a revision couldn't be seeded).
 */
export async function seedRevisionForCompletion(
  userId: string,
  surahId: number,
  now: Date = new Date()
): Promise<{ id: string } | null> {
  const existing = await prisma.revisionSchedule.findFirst({
    where: { userId, surahId, status: 'PENDING' },
    select: { id: true },
  });
  if (existing) return existing;

  const scheduledFor = new Date(now);
  scheduledFor.setUTCDate(scheduledFor.getUTCDate() + 1); // +1 day, per spec

  return prisma.revisionSchedule.create({
    data: { userId, surahId, scheduledFor, status: 'PENDING' },
    select: { id: true },
  });
}

/**
 * Fetch revision schedules for a user (student view: own only; teacher view: assigned students only).
 *
 * `opts.due` filters to PENDING revisions with `scheduledFor <= now` — the
 * "due today" view for the student mobile home screen.
 */
export const getRevisions = async (
  userId: string,
  userRole: 'STUDENT' | 'TEACHER',
  surahId?: number,
  opts: { due?: boolean } = {}
) => {
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

  if (opts.due) {
    where.status = 'PENDING';
    where.scheduledFor = { lte: new Date() };
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
 * Mark a revision as COMPLETED or MISSED. Anyone owning the record or a
 * TEACHER/ADMIN can update.
 *
 * Phase 4: after the status update, run SM-2 against the just-closed card
 * and create the next PENDING revision. This is what turns the static
 * schedule into a self-driving spaced-repetition engine.
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
    select: { userId: true, status: true, surahId: true, interval: true, easeFactor: true, repetitions: true },
  });
  if (!revision) throw new AppError(404, 'Revision not found');

  // Students can only update their own; teachers must have an accepted appointment; admins can update any
  if (callerRole === 'STUDENT' && revision.userId !== callerId) {
    throw new AppError(403, 'You can only update your own revisions');
  }
  if (callerRole === 'TEACHER') {
    await assertTeacherCanAccessStudent(callerId, revision.userId);
  }

  // First close the current card…
  const updated = await prisma.revisionSchedule.update({
    where: { id: revisionId },
    data: { status, notedAt: new Date() },
    include: { surah: true },
  });

  // …then schedule the next one via SM-2. The teacher/student can pass an
  // optional quality via the controller; when omitted we treat a manual
  // "COMPLETED" mark as quality 4 and a "MISSED" mark as quality 2.
  const quality: RevisionQuality = status === 'COMPLETED' ? 4 : 2;
  const next = computeSm2(
    { interval: revision.interval, easeFactor: revision.easeFactor, repetitions: revision.repetitions },
    quality
  );
  const nextDue = new Date();
  nextDue.setUTCDate(nextDue.getUTCDate() + next.interval);

  await prisma.revisionSchedule.create({
    data: {
      userId: revision.userId,
      surahId: revision.surahId,
      scheduledFor: nextDue,
      status: 'PENDING',
      interval: next.interval,
      easeFactor: next.easeFactor,
      repetitions: next.repetitions,
    },
  });

  // Best-effort "revision logged" notification — never block on this.
  try {
    await notifyUser({
      userId: revision.userId,
      event: status === 'COMPLETED' ? 'revision_completed' : 'revision_missed',
      data: { revisionId, surahId: revision.surahId, nextIntervalDays: next.interval },
    });
  } catch {
    /* notification is best-effort */
  }

  return updated;
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
    select: { userId: true, status: true },
  });
  if (!revision) throw new AppError(404, 'Revision not found');
  if (revision.status === 'COMPLETED') throw new AppError(409, 'Cannot delete a completed revision');

  if (callerRole === 'STUDENT' && revision.userId !== callerId) {
    throw new AppError(403, 'You can only delete your own revisions');
  }
  if (callerRole === 'TEACHER') {
    await assertTeacherCanAccessStudent(callerId, revision.userId);
  }

  await prisma.revisionSchedule.delete({ where: { id: revisionId } });
  return { success: true };
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
