import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

export type PlanPace = 'ON_PACE' | 'BEHIND' | 'AHEAD';

async function assertTeacherCanAccessStudent(teacherId: string, studentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { teacherId, studentId, status: 'ACCEPTED' },
    select: { id: true },
  });
  if (!appointment) throw new AppError(403, 'No accepted appointment with this student');
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

export const getPlan = async (planId: string, callerId: string, callerRole: 'STUDENT' | 'TEACHER' | 'ADMIN') => {
  const plan = await prisma.curriculumPlan.findUnique({
    where: { id: planId },
    include: { items: { include: { surah: true }, orderBy: { order: 'asc' } } },
  });
  if (!plan) throw new AppError(404, 'Plan not found');
  if (callerRole === 'STUDENT' && plan.studentId !== callerId) throw new AppError(404, 'Plan not found');
  if (callerRole === 'TEACHER' && plan.teacherId !== callerId) throw new AppError(404, 'Plan not found');

  return attachPace(plan);
};

export const listPlans = async (userId: string, userRole: 'STUDENT' | 'TEACHER' | 'ADMIN') => {
  const where = userRole === 'ADMIN' ? {} : userRole === 'STUDENT' ? { studentId: userId } : { teacherId: userId };

  const plans = await prisma.curriculumPlan.findMany({
    where,
    include: { items: { include: { surah: true }, orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(plans.map(attachPace));
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
