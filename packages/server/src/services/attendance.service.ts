import type { AttendanceStatus } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { notifyUser } from './notification.service';

const ALLOWED_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

export type AttendanceStatusInput = (typeof ALLOWED_STATUSES)[number];

/**
 * Mirrors the `assertTeacherCanAccessStudent` guard used by grade, recording,
 * memorization, revision, and export services. Requires an ACCEPTED appointment
 * between the teacher and the student and excludes soft-deleted users.
 */
async function assertTeacherCanAccessStudent(teacherId: string, studentId: string) {
  const [appointment, teacher, student] = await Promise.all([
    prisma.appointment.findFirst({
      where: { teacherId, studentId, status: 'ACCEPTED' },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { id: teacherId }, select: { deletedAt: true } }),
    prisma.user.findUnique({ where: { id: studentId }, select: { deletedAt: true } }),
  ]);
  if (!appointment || teacher?.deletedAt || student?.deletedAt) {
    throw new AppError(403, 'No accepted appointment with this student');
  }
}

/**
 * Record attendance for a single appointment.
 *
 * Side effects (in a single transaction):
 *   1. Insert a SessionRecord row (1:1 with Appointment — uniqueness enforced)
 *   2. Flip Appointment.status → COMPLETED
 *
 * On success, fires a Phase-1 notification to the student ("attendance_recorded").
 */
export const recordAttendance = async (
  appointmentId: string,
  teacherId: string,
  status: AttendanceStatusInput,
  notes?: string
) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new AppError(400, `status must be one of ${ALLOWED_STATUSES.join(', ')}`);
  }

  // Pre-flight: appointment must exist and belong to this teacher.
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, teacherId: true, studentId: true, status: true },
  });
  if (!appointment) throw new AppError(404, 'Appointment not found');
  if (appointment.teacherId !== teacherId) {
    throw new AppError(403, 'You are not the teacher for this appointment');
  }

  // Guard: teacher must have an accepted appointment with the student.
  await assertTeacherCanAccessStudent(teacherId, appointment.studentId);

  // Idempotency: refuse a second record for the same appointment.
  const existing = await prisma.sessionRecord.findUnique({ where: { appointmentId } });
  if (existing) throw new AppError(409, 'Attendance has already been recorded for this appointment');

  // Atomic write: create SessionRecord + flip Appointment to COMPLETED.
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.sessionRecord.create({
      data: {
        appointmentId,
        studentId: appointment.studentId,
        teacherId,
        status,
        notes: notes ?? null,
      },
      include: {
        appointment: { select: { requestedDate: true, requestedTime: true } },
      },
    });
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    });
    return record;
  });

  // Fire-and-log Phase-1 notification (durable feed picks it up automatically).
  await notifyUser({
    userId: result.studentId,
    event: 'attendance_recorded',
    data: {
      appointmentId: result.appointmentId,
      status: result.status,
      recordedAt: result.recordedAt,
    },
    push: {
      title: `Attendance marked: ${humanStatus(result.status)}`,
      body: `Your teacher marked you ${humanStatus(result.status).toLowerCase()} for the session on ${formatDate(
        result.appointment.requestedDate
      )}.`,
    },
  });

  return result;
};

/**
 * Read attendance history for a student.
 *
 * Authorization:
 *   - ADMIN: any student
 *   - TEACHER: any student with whom they have an ACCEPTED appointment
 *   - STUDENT: themselves only
 */
export const getStudentAttendance = async (
  callerId: string,
  callerRole: 'STUDENT' | 'TEACHER' | 'ADMIN',
  studentId: string
) => {
  if (callerRole === 'STUDENT' && callerId !== studentId) {
    throw new AppError(403, 'You can only view your own attendance');
  }
  if (callerRole === 'TEACHER') {
    await assertTeacherCanAccessStudent(callerId, studentId);
  }

  return prisma.sessionRecord.findMany({
    where: { studentId },
    orderBy: { recordedAt: 'desc' },
    include: {
      appointment: { select: { requestedDate: true, requestedTime: true, durationMinutes: true } },
    },
  });
};

// ─── helpers ────────────────────────────────────────────────────────────────

function humanStatus(s: AttendanceStatus): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US');
}
