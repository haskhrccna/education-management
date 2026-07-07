import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { bookOccurrence } from './appointment.service';

const DEFAULT_WEEKS_AHEAD = 8;

export interface GeneratedOccurrence {
  date: Date;
  created: boolean;
  appointmentId?: string;
  skippedReason?: string;
}

/** The next date on/after `from` that falls on `dayOfWeek` (0=Sun..6=Sat). Includes `from` itself if it already matches. */
function nextOccurrenceOnOrAfter(dayOfWeek: number, from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

async function generateOccurrences(
  slot: { id: string; studentId: string; teacherId: string; dayOfWeek: number; time: string; durationMinutes: number },
  count: number
): Promise<GeneratedOccurrence[]> {
  const results: GeneratedOccurrence[] = [];
  const firstDate = nextOccurrenceOnOrAfter(slot.dayOfWeek, new Date());

  for (let i = 0; i < count; i++) {
    const date = new Date(firstDate);
    date.setDate(date.getDate() + i * 7);
    try {
      const appt = await prisma.$transaction(
        (tx) =>
          bookOccurrence(tx, {
            studentId: slot.studentId,
            teacherId: slot.teacherId,
            requestedDate: date,
            requestedTime: slot.time,
            durationMinutes: slot.durationMinutes,
            recurringSlotId: slot.id,
          }),
        { isolationLevel: 'Serializable' }
      );
      results.push({ date, created: true, appointmentId: appt.id });
    } catch (err) {
      results.push({ date, created: false, skippedReason: err instanceof AppError ? err.message : 'Unknown error' });
    }
  }
  return results;
}

export const createRecurringSlot = async (
  studentId: string,
  teacherId: string,
  dayOfWeek: number,
  time: string,
  durationMinutes?: number,
  weeksAhead: number = DEFAULT_WEEKS_AHEAD
) => {
  if (dayOfWeek < 0 || dayOfWeek > 6) throw new AppError(400, 'dayOfWeek must be between 0 and 6');

  const teacherUser = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacherUser || teacherUser.role !== 'TEACHER') throw new AppError(400, 'Invalid teacher');

  const slot = await prisma.recurringSlot.create({
    data: { studentId, teacherId, dayOfWeek, time, durationMinutes: durationMinutes || 60 },
  });

  const occurrences = await generateOccurrences(slot, weeksAhead);
  return { slot, occurrences };
};

export const listRecurringSlots = async (userId: string, userRole: 'STUDENT' | 'TEACHER' | 'ADMIN') => {
  const where = userRole === 'ADMIN' ? {} : userRole === 'STUDENT' ? { studentId: userId } : { teacherId: userId };
  return prisma.recurringSlot.findMany({ where, orderBy: { createdAt: 'desc' } });
};

/** Not-found and not-yours both 404 — consistent with setDigestOptOut's precedent of not revealing existence to non-owners. */
async function assertCanManageSlot(slotId: string, userId: string, userRole: string) {
  const slot = await prisma.recurringSlot.findUnique({ where: { id: slotId } });
  if (!slot || (userRole !== 'ADMIN' && slot.teacherId !== userId && slot.studentId !== userId)) {
    throw new AppError(404, 'Recurring slot not found');
  }
  return slot;
}

/** Prospective only — never touches already-generated Appointment rows (per roadmap 2.3's AC). */
export const updateRecurringSlot = async (
  slotId: string,
  userId: string,
  userRole: string,
  updates: { dayOfWeek?: number; time?: string; durationMinutes?: number }
) => {
  await assertCanManageSlot(slotId, userId, userRole);
  if (updates.dayOfWeek !== undefined && (updates.dayOfWeek < 0 || updates.dayOfWeek > 6)) {
    throw new AppError(400, 'dayOfWeek must be between 0 and 6');
  }
  return prisma.recurringSlot.update({ where: { id: slotId }, data: updates });
};

/** Deactivates the series. Individual occurrences must be cancelled separately via the existing appointment flow. */
export const cancelRecurringSlot = async (slotId: string, userId: string, userRole: string) => {
  await assertCanManageSlot(slotId, userId, userRole);
  return prisma.recurringSlot.update({ where: { id: slotId }, data: { active: false } });
};

/**
 * Weekly-cron entry point: for every active slot, generate exactly one more
 * occurrence 7 days past whatever was generated last — keeps a rolling
 * window of future appointments without ever regenerating the past.
 */
export const extendActiveRecurringSlots = async (): Promise<number> => {
  const slots = await prisma.recurringSlot.findMany({ where: { active: true } });

  let generated = 0;
  for (const slot of slots) {
    const latest = await prisma.appointment.findFirst({
      where: { recurringSlotId: slot.id },
      orderBy: { requestedDate: 'desc' },
      select: { requestedDate: true },
    });
    if (!latest) continue;

    const nextDate = new Date(latest.requestedDate);
    nextDate.setDate(nextDate.getDate() + 7);

    try {
      await prisma.$transaction(
        (tx) =>
          bookOccurrence(tx, {
            studentId: slot.studentId,
            teacherId: slot.teacherId,
            requestedDate: nextDate,
            requestedTime: slot.time,
            durationMinutes: slot.durationMinutes,
            recurringSlotId: slot.id,
          }),
        { isolationLevel: 'Serializable' }
      );
      generated++;
    } catch {
      /* conflict/duplicate at the rolling edge — best-effort, try again next run */
    }
  }
  return generated;
};
