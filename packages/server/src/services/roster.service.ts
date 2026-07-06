import { prisma } from '../prisma/client';

const CONSECUTIVE_MISSED_THRESHOLD = 2;
const STREAK_BROKEN_WINDOW_DAYS = 7;
const GRADE_GAP_THRESHOLD_DAYS = 14;

export type AtRiskReason = 'MISSED_SESSIONS' | 'STREAK_BROKEN' | 'GRADE_GAP';

export interface RosterHealthRow {
  studentId: string;
  firstName: string;
  lastName: string;
  atRisk: boolean;
  reasons: AtRiskReason[];
}

/**
 * A teacher's own roster (every student with an ACCEPTED appointment),
 * flagged at-risk on any of three signals. Thresholds are fixed constants
 * for now — admin-configurable thresholds are a follow-up, not yet built.
 */
export const getRosterHealth = async (teacherId: string): Promise<RosterHealthRow[]> => {
  const appts = await prisma.appointment.findMany({
    where: { teacherId, status: 'ACCEPTED' },
    select: { studentId: true },
  });
  const studentIds = Array.from(new Set(appts.map((a) => a.studentId)));
  if (studentIds.length === 0) return [];

  const now = Date.now();
  const streakWindowStart = new Date(now - STREAK_BROKEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const gradeGapStart = new Date(now - GRADE_GAP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const [students, streaks, latestGrades, sessionRecords] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.streak.findMany({ where: { userId: { in: studentIds } } }),
    prisma.grade.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, teacherId },
      _max: { createdAt: true },
    }),
    // Ordered newest-first across all students; per-student relative order
    // is preserved, which is all `recentStatusesByStudent` below needs.
    prisma.sessionRecord.findMany({
      where: { studentId: { in: studentIds }, teacherId },
      orderBy: { recordedAt: 'desc' },
      select: { studentId: true, status: true },
    }),
  ]);

  const streakByStudent = new Map(streaks.map((s) => [s.userId, s]));
  const latestGradeByStudent = new Map(latestGrades.map((g) => [g.studentId, g._max.createdAt]));

  const recentStatusesByStudent = new Map<string, string[]>();
  for (const rec of sessionRecords) {
    const list = recentStatusesByStudent.get(rec.studentId) ?? [];
    if (list.length < CONSECUTIVE_MISSED_THRESHOLD) list.push(rec.status);
    recentStatusesByStudent.set(rec.studentId, list);
  }

  return students.map((student) => {
    const reasons: AtRiskReason[] = [];

    const recentStatuses = recentStatusesByStudent.get(student.id) ?? [];
    if (recentStatuses.length === CONSECUTIVE_MISSED_THRESHOLD && recentStatuses.every((s) => s === 'ABSENT')) {
      reasons.push('MISSED_SESSIONS');
    }

    const streak = streakByStudent.get(student.id);
    if (
      streak &&
      streak.currentStreak === 0 &&
      streak.longestStreak > 0 &&
      streak.lastActiveDate >= streakWindowStart
    ) {
      reasons.push('STREAK_BROKEN');
    }

    const lastGradeAt = latestGradeByStudent.get(student.id);
    if (!lastGradeAt || lastGradeAt < gradeGapStart) {
      reasons.push('GRADE_GAP');
    }

    return {
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      atRisk: reasons.length > 0,
      reasons,
    };
  });
};
