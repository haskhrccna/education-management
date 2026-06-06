import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyUser } from './notification.service';

// ─── Streak math ─────────────────────────────────────────────────────────────

/** Format a Date as its UTC date-only "YYYY-MM-DD" string. Used as the
 *  `lastActiveDate` discriminator. Pure and side-effect free. */
export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Returns one of:
 *  - `'same-day'`  : same UTC day, no change
 *  - `'consec'`    : exactly +1 day, increment
 *  - `'reset'`     : >= 2 days later, reset to 1
 *  - `'first'`     : no prior streak row, start at 1
 */
export type StreakOutcome = 'same-day' | 'consec' | 'reset' | 'first';

export function classifyStreakUpdate(
  prev: Pick<{ lastActiveDate: Date | null; currentStreak: number }, 'lastActiveDate' | 'currentStreak'> | null,
  now: Date
): StreakOutcome {
  if (!prev) return 'first';
  const prevDay = utcDateString(prev.lastActiveDate ?? now);
  const today = utcDateString(now);
  if (prevDay === today) return 'same-day';
  // Compare day-distance in UTC. We construct Date objects at UTC midnight
  // so the diff is exact (no DST surprises).
  const a = new Date(prevDay + 'T00:00:00Z').getTime();
  const b = new Date(today + 'T00:00:00Z').getTime();
  const days = Math.round((b - a) / 86_400_000);
  return days === 1 ? 'consec' : 'reset';
}

/**
 * Mark a student as "active today". Updates the streak row per the rules:
 *  - same day  → no change
 *  - +1 day    → current += 1 (and longest = max(longest, current))
 *  - 2+ days   → current = 1
 *  - first     → current = 1
 *
 * Idempotent under a transaction (the caller wraps in `$transaction` if
 * combined with other writes; here we just upsert).
 */
export const recordActivity = async (userId: string, when: Date = new Date()) => {
  const prev = await prisma.streak.findUnique({
    where: { userId },
    select: { currentStreak: true, longestStreak: true, lastActiveDate: true },
  });

  const outcome = classifyStreakUpdate(
    prev ? { lastActiveDate: prev.lastActiveDate, currentStreak: prev.currentStreak } : null,
    when
  );
  const todayStr = utcDateString(when);
  // Prisma's DATE type is a Date object at UTC midnight.
  const lastActiveDate = new Date(todayStr + 'T00:00:00.000Z');

  if (outcome === 'same-day') {
    return { outcome, currentStreak: prev?.currentStreak ?? 0, longestStreak: prev?.longestStreak ?? 0 };
  }

  const nextCurrent = outcome === 'first' || outcome === 'reset' ? 1 : (prev?.currentStreak ?? 0) + 1;
  const nextLongest = Math.max(prev?.longestStreak ?? 0, nextCurrent);

  return prisma.streak
    .upsert({
      where: { userId },
      create: { userId, currentStreak: nextCurrent, longestStreak: nextLongest, lastActiveDate },
      update: { currentStreak: nextCurrent, longestStreak: nextLongest, lastActiveDate },
    })
    .then((row) => ({ outcome, ...row }));
};

// ─── Badges ──────────────────────────────────────────────────────────────────

/**
 * Award a badge to a user. Idempotent: if the (userId, badgeId) pair already
 * exists, returns the existing row. Otherwise creates a new award.
 *
 * Fires a `badge_earned` notification on first-award (not on idempotent hits).
 */
export const awardBadge = async (userId: string, code: string) => {
  const badge = await prisma.badge.findUnique({ where: { code } });
  if (!badge) throw new AppError(500, `Badge catalog missing code: ${code}`);

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (existing) return { newlyAwarded: false, userBadge: existing };

  const userBadge = await prisma.userBadge.create({
    data: { userId, badgeId: badge.id },
    include: { badge: true },
  });

  // Best-effort notification — never throw.
  try {
    await notifyUser({
      userId,
      event: 'badge_earned',
      data: { badgeCode: badge.code, badgeName: badge.name, iconKey: badge.iconKey },
    });
  } catch {
    /* best-effort */
  }

  return { newlyAwarded: true, userBadge };
};

/**
 * Run all milestone checks for a user and award any newly-earned badges.
 * Safe to call on every activity (the UNIQUE on user_badges makes it idempotent).
 *
 * Returns the list of badges newly awarded this run (for UI toasts etc.).
 */
export const evaluateMilestones = async (userId: string) => {
  const streak = await prisma.streak.findUnique({
    where: { userId },
    select: { currentStreak: true },
  });

  const [completedSurahs, completedRevisions, distinctSurahs] = await Promise.all([
    prisma.memorizationProgress.count({ where: { userId, status: 'COMPLETE' } }),
    prisma.revisionSchedule.count({ where: { userId, status: 'COMPLETED' } }),
    // Phase 5 simplified: a "juz" = 30 distinct memorized surahs.
    // Phase 6 (Mushaf) will introduce a real juz map; tighten then.
    prisma.memorizationProgress.findMany({
      where: { userId, status: 'COMPLETE' },
      distinct: ['surahId'],
      select: { surahId: true },
    }),
  ]);

  const candidates: Array<{ code: string; condition: boolean }> = [
    { code: 'first_surah_memorized', condition: completedSurahs >= 1 },
    { code: 'first_revision_completed', condition: completedRevisions >= 1 },
    { code: 'juz_complete', condition: distinctSurahs.length >= 30 },
    { code: 'streak_7', condition: (streak?.currentStreak ?? 0) >= 7 },
    { code: 'streak_30', condition: (streak?.currentStreak ?? 0) >= 30 },
  ];

  const awarded: Array<{ code: string; newlyAwarded: boolean }> = [];
  for (const c of candidates) {
    if (!c.condition) continue;
    const result = await awardBadge(userId, c.code);
    awarded.push({ code: c.code, newlyAwarded: result.newlyAwarded });
  }
  return awarded;
};

// ─── Read API ────────────────────────────────────────────────────────────────

export const getMyGamification = async (userId: string) => {
  const [streak, badges] = await Promise.all([
    prisma.streak.findUnique({ where: { userId } }),
    prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
      include: { badge: true },
    }),
  ]);
  return {
    streak: streak ?? { userId, currentStreak: 0, longestStreak: 0, lastActiveDate: null },
    badges: badges.map((b) => ({
      code: b.badge.code,
      name: b.badge.name,
      description: b.badge.description,
      iconKey: b.badge.iconKey,
      earnedAt: b.earnedAt,
    })),
  };
};

/**
 * Top-N leaderboard of students by `currentStreak`.
 *
 * `scope`:
 *  - `'all'`            → every student
 *  - `'teacher:<id>'`   → only students with an ACCEPTED appointment with <id>
 *  - anything else      → treated as 'all' (safe default)
 */
export const getLeaderboard = async (scope: string | undefined, limit = 20) => {
  let studentIds: string[] | undefined;
  if (scope?.startsWith('teacher:')) {
    const teacherId = scope.slice('teacher:'.length);
    const appts = await prisma.appointment.findMany({
      where: { teacherId, status: 'ACCEPTED' },
      select: { studentId: true },
    });
    studentIds = Array.from(new Set(appts.map((a) => a.studentId)));
    if (studentIds.length === 0) return [];
  }

  const where = studentIds ? { userId: { in: studentIds } } : undefined;
  const rows = await prisma.streak.findMany({
    where,
    orderBy: [{ currentStreak: 'desc' }, { longestStreak: 'desc' }],
    take: Math.min(Math.max(limit, 1), 100),
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: `${r.user.firstName} ${r.user.lastName}`,
    currentStreak: r.currentStreak,
    longestStreak: r.longestStreak,
  }));
};
