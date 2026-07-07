import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyAppointmentUpdate } from './notification.service';
import { notifyScheduleChange } from './socket.service';

type UserRoleInput = 'STUDENT' | 'TEACHER' | 'ADMIN';

// Derived from the actual (audit-log-extended) prisma singleton's own
// $transaction signature, rather than the base Prisma.TransactionClient —
// the extension changes the client's type enough that the base type doesn't
// structurally match.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toDateOnly(dateInput: string | Date): Date {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * The one place a single occurrence gets booked: duplicate check, overlap
 * check, then create. Used directly by createAppointment below, and reused
 * as-is by the recurring-slot generator (roadmap 2.3) — no parallel booking
 * model for generated occurrences.
 */
export async function bookOccurrence(
  tx: TxClient,
  params: {
    studentId: string;
    teacherId: string;
    requestedDate: string | Date;
    requestedTime: string;
    durationMinutes?: number;
    recurringSlotId?: string;
  }
) {
  const { studentId, teacherId, requestedTime, durationMinutes, recurringSlotId } = params;
  const dateOnly = toDateOnly(params.requestedDate);
  const nextDay = new Date(dateOnly);
  nextDay.setDate(nextDay.getDate() + 1);

  // Prevent duplicate: same student already has a pending/accepted slot with this teacher at this time
  const duplicate = await tx.appointment.findFirst({
    where: {
      studentId,
      teacherId,
      requestedDate: { gte: dateOnly, lt: nextDay },
      requestedTime,
      status: { in: ['REQUESTED', 'ACCEPTED'] },
    },
  });
  if (duplicate) throw new AppError(409, 'You already have a pending or accepted appointment at this time');

  const conflicts = await tx.appointment.findMany({
    where: {
      teacherId,
      requestedDate: { gte: dateOnly, lt: nextDay },
      status: { in: ['REQUESTED', 'ACCEPTED'] },
    },
  });

  const newStart = timeToMinutes(requestedTime);
  const newEnd = newStart + (durationMinutes || 60);

  for (const existing of conflicts) {
    const existingStart = timeToMinutes(existing.requestedTime);
    const existingEnd = existingStart + (existing.durationMinutes || 60);
    if (timesOverlap(newStart, newEnd, existingStart, existingEnd)) {
      throw new AppError(409, 'Teacher already has an appointment overlapping this time');
    }
  }

  return tx.appointment.create({
    data: {
      studentId,
      teacherId,
      requestedDate: dateOnly,
      requestedTime,
      durationMinutes: durationMinutes || 60,
      recurringSlotId: recurringSlotId ?? null,
    },
  });
}

export const createAppointment = async (
  studentId: string,
  teacherId: string,
  requestedDate: string,
  requestedTime: string,
  durationMinutes: number
) => {
  const appointment = await prisma.$transaction(
    async (tx) => {
      const teacherUser = await tx.user.findUnique({ where: { id: teacherId } });
      if (!teacherUser || teacherUser.role !== 'TEACHER') throw new AppError(400, 'Invalid teacher');

      return bookOccurrence(tx, { studentId, teacherId, requestedDate, requestedTime, durationMinutes });
    },
    { isolationLevel: 'Serializable' }
  );

  notifyScheduleChange(teacherId, appointment);
  return appointment;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function timesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export const getMyAppointments = async (userId: string, userRole: UserRoleInput) => {
  if (userRole === 'STUDENT') {
    return await prisma.appointment.findMany({
      where: { studentId: userId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { requestedDate: 'desc' },
    });
  }
  return await prisma.appointment.findMany({
    where: { teacherId: userId },
    include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { requestedDate: 'desc' },
  });
};

export const manageAppointment = async (
  appointmentId: string,
  userId: string,
  userRole: string,
  action: string,
  amendedNote?: string
) => {
  const validActions = ['ACCEPTED', 'AMENDED', 'REJECTED'];
  if (!validActions.includes(action)) throw new AppError(400, 'Invalid action');

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) throw new AppError(404, 'Appointment not found');
  if (userRole !== 'ADMIN' && appointment.teacherId !== userId) {
    throw new AppError(403, 'You can only manage your own appointments');
  }

  const updateData: Record<string, unknown> = { status: action };
  if (action === 'ACCEPTED') updateData.approvedAt = new Date();
  if (action === 'REJECTED') updateData.rejectedAt = new Date();
  if (amendedNote) updateData.amendedNote = amendedNote;

  const updated = await prisma.appointment.update({ where: { id: appointmentId }, data: updateData });

  // Notify student of schedule change
  await notifyAppointmentUpdate(appointment.studentId, updated);

  return updated;
};
