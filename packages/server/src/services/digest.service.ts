import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyUser } from './notification.service';
import { buildRevisionQueue } from './revision-queue.service';
import { logger } from '../lib/logger';

const DIGEST_WINDOW_DAYS = 7;

export interface WeeklyDigestContent {
  studentId: string;
  studentName: string;
  sessionsAttended: number;
  sessionsMissed: number;
  currentStreak: number;
  gradesSinceLastDigest: { grade: string; type: string; createdAt: Date }[];
  nextAppointment: { requestedDate: Date; requestedTime: string } | null;
  /** F7/AC7.2 — hifz-loop signals from H1. */
  pagesMemorizedThisWeek: number;
  revisionDueToday: number;
  hasActivity: boolean;
}

/** One child's digest content for the window ending `now`, starting at `since`. */
export const buildWeeklyDigest = async (studentId: string, since: Date): Promise<WeeklyDigestContent> => {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [student, sessions, streak, grades, nextAppointment, pagesMemorizedThisWeek, queuePages, weakFlags, overrides] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } }),
      prisma.sessionRecord.findMany({
        where: { studentId, recordedAt: { gte: since } },
        select: { status: true },
      }),
      prisma.streak.findUnique({ where: { userId: studentId } }),
      prisma.grade.findMany({
        where: { studentId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { grade: true, type: true, createdAt: true },
      }),
      prisma.appointment.findFirst({
        where: { studentId, status: { in: ['ACCEPTED', 'REQUESTED'] }, requestedDate: { gte: new Date() } },
        orderBy: { requestedDate: 'asc' },
        select: { requestedDate: true, requestedTime: true },
      }),
      // F7/AC7.2: pages newly memorized in the window.
      prisma.pageMemorization.count({
        where: { userId: studentId, status: { in: ['MEMORIZED', 'SOLID'] }, updatedAt: { gte: since } },
      }),
      // Inputs for today's revision load — same rows getRevisionQueue reads;
      // the digest is system context, so the requester guard doesn't apply.
      prisma.pageMemorization.findMany({
        where: { userId: studentId, status: { in: ['MEMORIZED', 'SOLID'] } },
        select: { page: true, status: true, lastReviewedAt: true, updatedAt: true },
      }),
      prisma.weakAyahFlag.findMany({
        where: { studentId, status: 'ACTIVE' },
        select: { ayah: { select: { page: true } } },
      }),
      prisma.revisionSchedule.findMany({
        where: { userId: studentId, status: 'PENDING', scheduledFor: { lte: endOfToday } },
        select: { surahId: true, scheduledFor: true },
      }),
    ]);
  if (!student) throw new AppError(404, 'Student not found while building weekly digest');

  const sessionsAttended = sessions.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;
  const sessionsMissed = sessions.filter((s) => s.status === 'ABSENT').length;
  const revisionDueToday = buildRevisionQueue({
    today: now,
    pages: queuePages,
    weakPages: new Set(weakFlags.map((f) => f.ayah.page)),
    overrides,
  }).length;

  return {
    studentId,
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    sessionsAttended,
    sessionsMissed,
    currentStreak: streak?.currentStreak ?? 0,
    gradesSinceLastDigest: grades,
    nextAppointment,
    pagesMemorizedThisWeek,
    revisionDueToday,
    hasActivity: sessions.length > 0 || grades.length > 0 || pagesMemorizedThisWeek > 0,
  };
};

function formatDigestMessage(content: WeeklyDigestContent): { subject: string; body: string } {
  if (!content.hasActivity) {
    return {
      subject: `${content.studentName}'s week`,
      body: `No recorded activity for ${content.studentName} this week.`,
    };
  }
  const parts: string[] = [`${content.sessionsAttended} session(s) attended`];
  if (content.sessionsMissed > 0) parts.push(`${content.sessionsMissed} missed`);
  if (content.currentStreak > 0) parts.push(`current streak: ${content.currentStreak} day(s)`);
  if (content.gradesSinceLastDigest.length > 0) parts.push(`${content.gradesSinceLastDigest.length} new grade(s)`);
  if (content.pagesMemorizedThisWeek > 0) parts.push(`${content.pagesMemorizedThisWeek} page(s) memorized`);
  if (content.revisionDueToday > 0) parts.push(`${content.revisionDueToday} page(s) due for revision`);
  return { subject: `${content.studentName}'s week`, body: `${parts.join(', ')}.` };
}

/**
 * Send a digest to every parent with an APPROVED, non-opted-out link.
 * One family's failure is logged and never blocks the rest — this mirrors
 * the "best-effort, never throw" pattern already used across the codebase
 * for secondary side effects (notifications, gamification updates).
 */
export const sendWeeklyDigests = async (now: Date = new Date()): Promise<number> => {
  const since = new Date(now.getTime() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const links = await prisma.parentLink.findMany({
    where: { status: 'APPROVED', digestOptOut: false },
    select: { parentId: true, studentId: true },
  });

  let sent = 0;
  for (const link of links) {
    try {
      const content = await buildWeeklyDigest(link.studentId, since);
      const { subject, body } = formatDigestMessage(content);
      await notifyUser({
        userId: link.parentId,
        event: 'weekly_digest',
        data: { ...content },
        email: { subject, body },
        push: { title: subject, body },
      });
      sent++;
    } catch (err) {
      logger.error({ err, parentId: link.parentId, studentId: link.studentId }, 'Weekly digest failed for one link');
    }
  }
  return sent;
};

/** A parent opts a specific child's digest on/off. 404s if the link isn't theirs. */
export const setDigestOptOut = async (parentId: string, linkId: string, optOut: boolean) => {
  const link = await prisma.parentLink.findUnique({ where: { id: linkId } });
  if (!link || link.parentId !== parentId) {
    throw new AppError(404, 'Link not found');
  }
  return prisma.parentLink.update({ where: { id: linkId }, data: { digestOptOut: optOut } });
};
