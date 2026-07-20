import { prisma } from '../prisma/client';
import { notifyUser } from './notification.service';
import { logger } from '../lib/logger';

// F7 streak-risk nudge. Evening-window check is pure and unit-tested; the
// once-per-day guarantee rides the notifications table (type STREAK_NUDGE) —
// there is no user-level notification-prefs system yet (recorded deviation),
// so dedupe is the only opt-out mechanism for now.
const EVENING_HOUR = 20; // server-local
export const STREAK_NUDGE_TYPE = 'STREAK_NUDGE';

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function shouldNudge(input: { now: Date; lastActiveDate: Date; alreadyNudgedToday: boolean }): boolean {
  const { now, lastActiveDate, alreadyNudgedToday } = input;
  if (alreadyNudgedToday) return false;
  if (now.getHours() < EVENING_HOUR) return false;
  return !sameLocalDay(lastActiveDate, now);
}

/** Runs from the daily queue job: nudge every streak-holder who has not been
 *  active today and has not already been nudged today. Returns sent count. */
export async function sendStreakNudges(now: Date = new Date()): Promise<number> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const streaks = await prisma.streak.findMany({
    where: { currentStreak: { gt: 0 }, lastActiveDate: { lt: startOfToday } },
    select: { userId: true, currentStreak: true, lastActiveDate: true },
  });

  let sent = 0;
  for (const s of streaks) {
    const nudgedToday = await prisma.notification.findFirst({
      where: { userId: s.userId, type: STREAK_NUDGE_TYPE, createdAt: { gte: startOfToday } },
      select: { id: true },
    });
    if (!shouldNudge({ now, lastActiveDate: s.lastActiveDate, alreadyNudgedToday: nudgedToday != null })) continue;

    try {
      await notifyUser({
        userId: s.userId,
        event: STREAK_NUDGE_TYPE,
        data: { currentStreak: s.currentStreak },
        push: {
          title: 'حافظ على سلسلتك!',
          body: `سلسلتك ${s.currentStreak} يوماً — سجّل مراجعة قبل نهاية اليوم.`,
        },
      });
      sent++;
    } catch (err) {
      logger.error({ err, userId: s.userId }, 'Streak nudge failed');
    }
  }
  return sent;
}
