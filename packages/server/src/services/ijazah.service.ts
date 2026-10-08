import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { recordActivity, evaluateMilestones } from './gamification.service';

export type IjazahScope = 'SURAH' | 'JUZ' | 'FULL_QURAN';

const INCLUDE = {
  surah: true,
  teacher: { select: { id: true, firstName: true, lastName: true } },
  student: { select: { id: true, firstName: true, lastName: true } },
  chainIjazah: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } },
} as const;

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

/** Verifies the student has actually completed what this record claims to endorse. */
async function assertScopeIsComplete(
  studentId: string,
  scope: IjazahScope,
  surahId?: number,
  juzNumber?: number
): Promise<void> {
  if (scope === 'SURAH') {
    if (!surahId) throw new AppError(400, 'surahId is required for a SURAH-scope ijazah');
    const progress = await prisma.memorizationProgress.findUnique({
      where: { userId_surahId: { userId: studentId, surahId } },
    });
    if (progress?.status !== 'COMPLETE') throw new AppError(409, 'This surah is not yet fully memorized');
    return;
  }

  if (scope === 'JUZ') {
    if (!juzNumber) throw new AppError(400, 'juzNumber is required for a JUZ-scope ijazah');
    const surahsInJuz = await prisma.surah.findMany({ where: { juz: juzNumber }, select: { id: true } });
    if (surahsInJuz.length === 0) throw new AppError(404, 'No surahs found for that juz number');
    const completedCount = await prisma.memorizationProgress.count({
      where: { userId: studentId, status: 'COMPLETE', surahId: { in: surahsInJuz.map((s) => s.id) } },
    });
    if (completedCount < surahsInJuz.length) throw new AppError(409, 'Not every surah in this juz is memorized yet');
    return;
  }

  // FULL_QURAN
  const [completedCount, total] = await Promise.all([
    prisma.memorizationProgress.count({ where: { userId: studentId, status: 'COMPLETE' } }),
    prisma.surah.count(),
  ]);
  if (total === 0 || completedCount < total) throw new AppError(409, 'The full Quran is not yet fully memorized');
}

/**
 * A teacher formally endorses a student's completed portion — roadmap 3.1.
 * `chainIjazahId` optionally points at the endorsing teacher's own
 * certifying ijazah (must belong to that same teacher), building a real
 * sanad; `teacherChainRef` is a free-text fallback when it isn't in-system.
 */
export const issueIjazah = async (
  teacherId: string,
  studentId: string,
  scope: IjazahScope,
  opts: { surahId?: number; juzNumber?: number; teacherChainRef?: string; chainIjazahId?: string }
) => {
  await assertTeacherCanAccessStudent(teacherId, studentId);
  await assertScopeIsComplete(studentId, scope, opts.surahId, opts.juzNumber);

  if (opts.chainIjazahId) {
    const chainSource = await prisma.ijazah.findUnique({ where: { id: opts.chainIjazahId } });
    if (!chainSource || chainSource.teacherId !== teacherId) {
      throw new AppError(400, "chainIjazahId must reference the endorsing teacher's own ijazah record");
    }
  }

  const record = await prisma.ijazah.create({
    data: {
      studentId,
      teacherId,
      scope,
      surahId: scope === 'SURAH' ? opts.surahId : null,
      juzNumber: scope === 'JUZ' ? opts.juzNumber : null,
      teacherChainRef: opts.teacherChainRef ?? null,
      chainIjazahId: opts.chainIjazahId ?? null,
    },
    include: INCLUDE,
  });

  // Same best-effort event mechanism as every other completion in this app —
  // feeds 3.2's IJAZAH_ISSUED trigger, no bespoke wiring.
  try {
    await recordActivity(studentId);
    await evaluateMilestones(studentId);
  } catch {
    /* gamification is best-effort */
  }

  return record;
};

export const listIjazahs = async (userId: string, userRole: string) => {
  // See getIjazah: explicit per role, deny anything else.
  if (userRole !== 'ADMIN' && userRole !== 'STUDENT' && userRole !== 'TEACHER') {
    throw new AppError(403, 'Not allowed to list ijazahs');
  }
  const where = userRole === 'ADMIN' ? {} : userRole === 'STUDENT' ? { studentId: userId } : { teacherId: userId };
  return prisma.ijazah.findMany({ where, include: INCLUDE, orderBy: { issuedAt: 'desc' } });
};

/**
 * Deny by default. A PARENT used to match neither `if` and receive any
 * ijazah by id — the record carries the student's name and the issuing
 * teacher's attestation. Parents see their own children's credentials
 * through the parent dashboard.
 */
export const getIjazah = async (id: string, callerId: string, callerRole: string) => {
  const record = await prisma.ijazah.findUnique({ where: { id }, include: INCLUDE });
  if (!record) throw new AppError(404, 'Ijazah not found');
  if (callerRole === 'STUDENT') {
    if (record.studentId !== callerId) throw new AppError(404, 'Ijazah not found');
  } else if (callerRole === 'TEACHER') {
    if (record.teacherId !== callerId) throw new AppError(404, 'Ijazah not found');
  } else if (callerRole !== 'ADMIN') {
    throw new AppError(403, 'Not allowed to view ijazahs');
  }
  return record;
};
