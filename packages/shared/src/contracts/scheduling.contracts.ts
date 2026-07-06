import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';
import { CreateAppointmentSchema, ManageAppointmentSchema } from '../validators/common';
import { SubmitTeacherChangeSchema, DecideTeacherChangeSchema } from '../validators/teacherChange';

/** Raw prisma appointment echo — deep-pinned by scheduling-flows.itest.ts; loose for forward-compat. */
const Appointment = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  requestedDate: DateOut,
  requestedTime: z.string(),
  durationMinutes: z.number(),
  status: z.enum(['REQUESTED', 'ACCEPTED', 'AMENDED', 'REJECTED', 'COMPLETED', 'CANCELLED']),
});

const TeacherChangeRequest = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED']),
});

const SessionRecord = z.looseObject({
  id: z.string(),
  appointmentId: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  recordedAt: DateOut,
});

export const schedulingContracts = {
  listAppointments: defineContract({
    method: 'GET',
    path: '/api/v1/appointments',
    summary: 'Own appointments — student sees teacher relation, teacher/admin sees student relation (RAW array)',
    access: 'authenticated',
    responses: { 200: z.array(Appointment), 401: ErrorEnvelope },
  }),
  createAppointment: defineContract({
    method: 'POST',
    path: '/api/v1/appointments',
    summary: 'Student books a slot; duplicate/overlap → 409 (Serializable transaction)',
    access: [UserRole.STUDENT],
    request: { body: CreateAppointmentSchema },
    responses: { 201: Appointment, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 409: ErrorEnvelope },
  }),
  manageAppointment: defineContract({
    method: 'PUT',
    path: '/api/v1/appointments/:id',
    summary: 'Teacher (own) or admin (any) ACCEPTED/AMENDED/REJECTED',
    access: [UserRole.TEACHER, UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }), body: ManageAppointmentSchema },
    responses: { 200: Appointment, 400: ErrorEnvelope, 401: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  recordAttendance: defineContract({
    method: 'POST',
    path: '/api/v1/appointments/:id/attendance',
    summary:
      'Teacher records attendance; NO Zod body (legacy hand-validation, exact 400 message pinned); {success,data} envelope',
    access: [UserRole.TEACHER],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      201: z.object({ success: z.literal(true), data: SessionRecord }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  listAttendance: defineContract({
    method: 'GET',
    path: '/api/v1/attendance',
    summary: 'Attendance history; student defaults to self, others must pass ?studentId=; {success,data} envelope',
    access: 'authenticated',
    request: { query: z.object({ studentId: z.string().optional() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(SessionRecord) }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  submitTeacherChange: defineContract({
    method: 'POST',
    path: '/api/v1/teacher-changes',
    summary: 'Student requests a teacher change; one PENDING at a time',
    access: [UserRole.STUDENT],
    request: { body: SubmitTeacherChangeSchema },
    responses: {
      201: TeacherChangeRequest,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  listTeacherChanges: defineContract({
    method: 'GET',
    path: '/api/v1/teacher-changes',
    summary: 'Role-shaped list: student=own, teacher=PENDING against them, admin=all (+ ?status=)',
    access: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT],
    request: { query: z.object({ status: z.string().optional() }) },
    responses: { 200: z.array(TeacherChangeRequest), 401: ErrorEnvelope, 403: ErrorEnvelope },
  }),
  decideTeacherChange: defineContract({
    method: 'PATCH',
    path: '/api/v1/teacher-changes/:id',
    summary: 'Admin APPROVE (3 side effects: assignedTeacherId, migrate appts, synthetic ACCEPTED) or DENY',
    access: [UserRole.ADMIN],
    request: { params: z.object({ id: z.string() }), body: DecideTeacherChangeSchema },
    responses: {
      200: TeacherChangeRequest,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
};
