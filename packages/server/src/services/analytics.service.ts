import { prisma } from '../prisma/client';

const TOP_N = 10;

export async function getSurahMissRates() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [missed, attempted] = await Promise.all([
    prisma.revisionSchedule.groupBy({
      by: ['surahId'],
      _count: { id: true },
      where: { status: 'MISSED' },
      orderBy: { _count: { id: 'desc' } },
      take: TOP_N,
    }),
    prisma.revisionSchedule.groupBy({
      by: ['surahId'],
      _count: { id: true },
      where: { status: { in: ['MISSED', 'COMPLETED'] }, notedAt: { gte: sevenDaysAgo } },
    }),
  ]);

  if (missed.length === 0) return [];

  const surahIds = missed.map((r) => r.surahId);
  const surahs = await prisma.surah.findMany({
    where: { id: { in: surahIds } },
    select: { id: true, number: true, nameAr: true, nameEn: true },
  });
  const surahMap = new Map(surahs.map((s) => [s.id, s]));

  const attemptedMap = new Map(attempted.map((r) => [r.surahId, r._count.id]));

  return missed.map((r) => {
    const total = attemptedMap.get(r.surahId) ?? r._count.id;
    return {
      surah: surahMap.get(r.surahId) ?? { id: r.surahId },
      missCount: r._count.id,
      totalAttempts: total,
      missRate: total > 0 ? Math.round((r._count.id / total) * 100) : 100,
    };
  });
}

export async function getTeacherLoadDistribution() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      appointmentsAsTeacher: {
        where: { status: 'ACCEPTED' },
        select: { studentId: true },
      },
      gradesGiven: {
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { id: true },
      },
      sessionRecordsAsTeacher: {
        where: { recordedAt: { gte: thirtyDaysAgo } },
        select: { id: true },
      },
    },
  });

  return teachers.map((t) => ({
    teacher: { id: t.id, firstName: t.firstName, lastName: t.lastName, email: t.email },
    activeStudents: t.appointmentsAsTeacher.length,
    gradesLast30d: t.gradesGiven.length,
    sessionsLast30d: t.sessionRecordsAsTeacher.length,
  }));
}

export async function getWeeklyActiveStudents() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [count, total] = await Promise.all([
    prisma.user.count({
      where: {
        role: 'STUDENT',
        deletedAt: null,
        OR: [
          { revisionSchedules: { some: { notedAt: { gte: sevenDaysAgo } } } },
          { gradesReceived: { some: { createdAt: { gte: sevenDaysAgo } } } },
          { sessionRecordsAsStudent: { some: { recordedAt: { gte: sevenDaysAgo } } } },
        ],
      },
    }),
    prisma.user.count({ where: { role: 'STUDENT', deletedAt: null } }),
  ]);

  return { activeCount: count, totalStudents: total, activeRatePct: total > 0 ? Math.round((count / total) * 100) : 0 };
}
