import { prisma } from '../prisma/client';
import { cacheGet, cacheSet } from '../lib/redis';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'academy-health';
const CACHE_TTL_SECONDS = 3600; // 1h, per spec

export interface AcademyHealthMetrics {
  totalStudents: number;
  activeThisWeek: number;
  activeRatePct: number;
  pagesMemorizedThisWeek: number;
  revisionAdherencePct: number;
  atRiskCount: number;
  teacherLoad: { teacherId: string; firstName: string; lastName: string; activeStudents: number }[];
  completionRatePct: number;
  generatedAt: string;
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

/** Academy-wide at-risk count — same 3 signals as roster.service.ts's per-teacher
 *  getRosterHealth, computed directly here since that function is scoped to one
 *  teacher's roster and re-querying per teacher would be N+1. */
async function countAtRiskStudents(since7d: Date, since14d: Date): Promise<number> {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', deletedAt: null },
    select: { id: true },
  });
  if (students.length === 0) return 0;
  const studentIds = students.map((s) => s.id);

  const [streaks, latestGrades, recentSessions] = await Promise.all([
    prisma.streak.findMany({ where: { userId: { in: studentIds } } }),
    prisma.grade.groupBy({ by: ['studentId'], where: { studentId: { in: studentIds } }, _max: { createdAt: true } }),
    prisma.sessionRecord.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { recordedAt: 'desc' },
      select: { studentId: true, status: true },
    }),
  ]);

  const streakByStudent = new Map(streaks.map((s) => [s.userId, s]));
  const latestGradeByStudent = new Map(latestGrades.map((g) => [g.studentId, g._max.createdAt]));
  const recentByStudent = new Map<string, string[]>();
  for (const rec of recentSessions) {
    const list = recentByStudent.get(rec.studentId) ?? [];
    if (list.length < 2) list.push(rec.status);
    recentByStudent.set(rec.studentId, list);
  }

  let atRisk = 0;
  for (const id of studentIds) {
    const recent = recentByStudent.get(id) ?? [];
    const missedSessions = recent.length === 2 && recent.every((s) => s === 'ABSENT');
    const streak = streakByStudent.get(id);
    const streakBroken =
      !!streak && streak.currentStreak === 0 && streak.longestStreak > 0 && streak.lastActiveDate >= since7d;
    const lastGradeAt = latestGradeByStudent.get(id);
    const gradeGap = !lastGradeAt || lastGradeAt < since14d;
    if (missedSessions || streakBroken || gradeGap) atRisk++;
  }
  return atRisk;
}

export async function computeAcademyHealth(): Promise<AcademyHealthMetrics> {
  const now = new Date();
  const since7d = new Date(now.getTime() - SEVEN_DAYS_MS);
  const since14d = new Date(now.getTime() - 2 * SEVEN_DAYS_MS);

  const [
    totalStudents,
    activeThisWeek,
    pagesMemorizedThisWeek,
    completedRevisions,
    missedRevisions,
    atRiskCount,
    teachers,
    weekSessionRecords,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT', deletedAt: null } }),
    prisma.user.count({
      where: {
        role: 'STUDENT',
        deletedAt: null,
        OR: [
          { revisionSchedules: { some: { notedAt: { gte: since7d } } } },
          { gradesReceived: { some: { createdAt: { gte: since7d } } } },
          { sessionRecordsAsStudent: { some: { recordedAt: { gte: since7d } } } },
        ],
      },
    }),
    prisma.pageMemorization.count({ where: { status: { in: ['MEMORIZED', 'SOLID'] }, updatedAt: { gte: since7d } } }),
    prisma.revisionSchedule.count({ where: { status: 'COMPLETED', notedAt: { gte: since7d } } }),
    prisma.revisionSchedule.count({ where: { status: 'MISSED', notedAt: { gte: since7d } } }),
    countAtRiskStudents(since7d, since14d),
    prisma.user.findMany({
      where: { role: 'TEACHER', deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        appointmentsAsTeacher: { where: { status: 'ACCEPTED' }, select: { studentId: true } },
      },
    }),
    prisma.sessionRecord.findMany({ where: { recordedAt: { gte: since7d } }, select: { status: true } }),
  ]);

  const presentOrLate = weekSessionRecords.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;

  return {
    totalStudents,
    activeThisWeek,
    activeRatePct: pct(activeThisWeek, totalStudents),
    pagesMemorizedThisWeek,
    revisionAdherencePct: pct(completedRevisions, completedRevisions + missedRevisions),
    atRiskCount,
    teacherLoad: teachers.map((t) => ({
      teacherId: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      activeStudents: t.appointmentsAsTeacher.length,
    })),
    completionRatePct: pct(presentOrLate, weekSessionRecords.length),
    generatedAt: now.toISOString(),
  };
}

export async function getAcademyHealth(): Promise<AcademyHealthMetrics> {
  const cached = await cacheGet<AcademyHealthMetrics>(CACHE_KEY);
  if (cached) return cached;
  const fresh = await computeAcademyHealth();
  await cacheSet(CACHE_KEY, fresh, CACHE_TTL_SECONDS);
  return fresh;
}
