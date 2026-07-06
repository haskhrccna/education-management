import { schedulingContracts } from '@quran-review/shared';
import * as appointmentService from '../../services/appointment.service';
import * as attendanceService from '../../services/attendance.service';
import type { AttendanceStatusInput } from '../../services/attendance.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const ALLOWED: AttendanceStatusInput[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const listAppointments = defineRoute(schedulingContracts.listAppointments, async ({ userId, userRole }) => {
  const role = userRole as 'STUDENT' | 'TEACHER' | 'ADMIN';
  const appointments = await appointmentService.getMyAppointments(userId!, role);
  return { status: 200 as const, body: appointments };
});

const createAppointment = defineRoute(schedulingContracts.createAppointment, async ({ body, userId }) => {
  const appointment = await appointmentService.createAppointment(
    userId!,
    body.teacherId,
    String(body.requestedDate),
    String(body.requestedTime),
    body.durationMinutes || 60
  );
  return { status: 201 as const, body: appointment };
});

const manageAppointment = defineRoute(
  schedulingContracts.manageAppointment,
  async ({ params, body, userId, userRole }) => {
    const appointment = await appointmentService.manageAppointment(
      String(params.id),
      userId!,
      String(userRole),
      body.action,
      body.amendedNote
    );
    return { status: 200 as const, body: appointment };
  }
);

const recordAttendance = defineRoute(schedulingContracts.recordAttendance, async ({ params, userId, req }) => {
  // Legacy parity: no Zod on this route — hand-validate exactly like the old controller.
  const { status, notes } = (req.body ?? {}) as { status?: AttendanceStatusInput; notes?: unknown };
  if (!status || !ALLOWED.includes(status)) {
    throw new AppError(400, `status must be one of ${ALLOWED.join(', ')}`);
  }
  const record = await attendanceService.recordAttendance(
    String(params.id),
    userId!,
    status,
    typeof notes === 'string' && notes.length > 0 ? notes : undefined
  );
  return { status: 201 as const, body: { success: true as const, data: record } };
});

export const appointmentsRouter = buildContractRouter(
  [listAppointments, createAppointment, manageAppointment, recordAttendance],
  { mountPrefix: '/api/v1/appointments' }
);
