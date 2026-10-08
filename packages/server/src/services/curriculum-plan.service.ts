import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export type PlanPace = 'ON_PACE' | 'BEHIND' | 'AHEAD';

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

export interface CreatePlanItemInput {
  surahId: number;
  targetDate: Date;
}

export const createPlan = async (teacherId: string, studentId: string, name: string, items: CreatePlanItemInput[]) => {
  await assertTeacherCanAccessStudent(teacherId, studentId);
  if (items.length === 0) throw new AppError(400, 'A plan needs at least one surah');

  const surahIds = items.map((i) => i.surahId);
  if (new Set(surahIds).size !== surahIds.length) {
    throw new AppError(400, 'A plan cannot list the same surah twice');
  }
  const existingSurahs = await prisma.surah.count({ where: { id: { in: surahIds } } });
  if (existingSurahs !== surahIds.length) throw new AppError(404, 'One or more surahs not found');

  return prisma.curriculumPlan.create({
    data: {
      studentId,
      teacherId,
      name,
      items: {
        create: items.map((item, index) => ({ surahId: item.surahId, targetDate: item.targetDate, order: index })),
      },
    },
    include: { items: { include: { surah: true }, orderBy: { order: 'asc' } } },
  });
};

/** Compares actual completions against how many items SHOULD be done by now, per their target dates. */
async function computePace(studentId: string, items: { surahId: number; targetDate: Date }[]): Promise<PlanPace> {
  if (items.length === 0) return 'ON_PACE';

  const progresses = await prisma.memorizationProgress.findMany({
    where: { userId: studentId, surahId: { in: items.map((i) => i.surahId) }, status: 'COMPLETE' },
    select: { surahId: true },
  });
  const completedSurahIds = new Set(progresses.map((p) => p.surahId));

  const now = new Date();
  const completedCount = items.filter((i) => completedSurahIds.has(i.surahId)).length;
  const expectedByNowCount = items.filter((i) => i.targetDate <= now).length;

  if (completedCount < expectedByNowCount) return 'BEHIND';
  if (completedCount > expectedByNowCount) return 'AHEAD';
  return 'ON_PACE';
}

async function attachPace<T extends { studentId: string; items: { surahId: number; targetDate: Date }[] }>(
  plan: T
): Promise<T & { pace: PlanPace }> {
  const pace = await computePace(plan.studentId, plan.items);
  return { ...plan, pace };
}

/**
 * Pace for a whole list in ONE query instead of one per plan.
 *
 * listPlans used to be `Promise.all(plans.map(attachPace))`, and attachPace
 * queries memorizationProgress — so an admin listing every plan in the academy
 * issued one query per plan. Here the (student, surah) pairs of every plan are
 * fetched together and matched in memory.
 */
async function attachPaceToMany<T extends { studentId: string; items: { surahId: number; targetDate: Date }[] }>(
  plans: T[]
): Promise<(T & { pace: PlanPace })[]> {
  if (plans.length === 0) return [];

  const completed = await prisma.memorizationProgress.findMany({
    where: {
      status: 'COMPLETE',
      userId: { in: [...new Set(plans.map((p) => p.studentId))] },
      surahId: { in: [...new Set(plans.flatMap((p) => p.items.map((i) => i.surahId)))] },
    },
    select: { userId: true, surahId: true },
  });

  // One row per (student, surah) the student has finished.
  const completedByStudent = new Map<string, Set<number>>();
  for (const row of completed) {
    const set = completedByStudent.get(row.userId) ?? new Set<number>();
    set.add(row.surahId);
    completedByStudent.set(row.userId, set);
  }

  const now = new Date();
  return plans.map((plan) => {
    const done = completedByStudent.get(plan.studentId) ?? new Set<number>();
    const completedCount = plan.items.filter((i) => done.has(i.surahId)).length;
    const expectedByNowCount = plan.items.filter((i) => i.targetDate <= now).length;
    const pace: PlanPace =
      plan.items.length === 0
        ? 'ON_PACE'
        : completedCount < expectedByNowCount
          ? 'BEHIND'
          : completedCount > expectedByNowCount
            ? 'AHEAD'
            : 'ON_PACE';
    return { ...plan, pace };
  });
}

/**
 * Deny by default. The role is whatever the authenticated caller actually has,
 * not the three this function used to assume: a PARENT (or any role added
 * later) previously matched neither `if` and received the plan, whoever it
 * belonged to. Parents read their children through the parent dashboard.
 */
export const getPlan = async (planId: string, callerId: string, callerRole: string) => {
  const plan = await prisma.curriculumPlan.findUnique({
    where: { id: planId },
    include: { items: { include: { surah: true }, orderBy: { order: 'asc' } } },
  });
  if (!plan) throw new AppError(404, 'Plan not found');
  if (callerRole === 'STUDENT') {
    if (plan.studentId !== callerId) throw new AppError(404, 'Plan not found');
  } else if (callerRole === 'TEACHER') {
    if (plan.teacherId !== callerId) throw new AppError(404, 'Plan not found');
  } else if (callerRole !== 'ADMIN') {
    throw new AppError(403, 'Not allowed to view curriculum plans');
  }

  return attachPace(plan);
};

export const listPlans = async (userId: string, userRole: string) => {
  // Explicit per role rather than "everyone else is a teacher": the old
  // fallback happened to return nothing for a PARENT, which is the right
  // outcome reached by accident. Deny instead, like getPlan above.
  if (userRole !== 'ADMIN' && userRole !== 'STUDENT' && userRole !== 'TEACHER') {
    throw new AppError(403, 'Not allowed to list curriculum plans');
  }
  const where = userRole === 'ADMIN' ? {} : userRole === 'STUDENT' ? { studentId: userId } : { teacherId: userId };

  const plans = await prisma.curriculumPlan.findMany({
    where,
    include: { items: { include: { surah: true }, orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return attachPaceToMany(plans);
};

/**
 * Roadmap 2.2: "plan completion feeds the milestone pipeline through the
 * same event mechanism as everything else." Called after a surah
 * transitions into COMPLETE (memorization.service.ts) — checks whether that
 * completion finished any of the student's ACTIVE plans, and if so marks it
 * COMPLETED and re-fires the existing evaluateMilestones/recordActivity
 * pair, exactly like every other completion event in this codebase.
 * Best-effort: the caller wraps this and must never let it throw.
 */
export const checkAndCompletePlans = async (studentId: string): Promise<void> => {
  const activePlans = await prisma.curriculumPlan.findMany({
    where: { studentId, status: 'ACTIVE' },
    include: { items: true },
  });

  for (const plan of activePlans) {
    if (plan.items.length === 0) continue;
    const completedCount = await prisma.memorizationProgress.count({
      where: {
        userId: studentId,
        surahId: { in: plan.items.map((i) => i.surahId) },
        status: 'COMPLETE',
      },
    });
    if (completedCount === plan.items.length) {
      await prisma.curriculumPlan.update({ where: { id: plan.id }, data: { status: 'COMPLETED' } });
      const { recordActivity, evaluateMilestones } = await import('./gamification.service');
      await recordActivity(studentId);
      await evaluateMilestones(studentId);
    }
  }
};
