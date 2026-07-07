import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';

const RecurringSlot = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  dayOfWeek: z.number(),
  time: z.string(),
  durationMinutes: z.number(),
  active: z.boolean(),
});

const GeneratedOccurrence = z.object({
  date: DateOut,
  created: z.boolean(),
  appointmentId: z.string().optional(),
  skippedReason: z.string().optional(),
});

const CreateRecurringSlotBody = z.object({
  teacherId: z.string(),
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM (24-hour)'),
  durationMinutes: z.number().int().positive().optional(),
});

const UpdateRecurringSlotBody = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM (24-hour)')
    .optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export const recurringSlotsContracts = {
  create: defineContract({
    method: 'POST',
    path: '/api/v1/recurring-slots',
    summary:
      'Student books a standing weekly slot; generates a rolling batch of occurrences via the existing per-occurrence booking logic',
    access: [UserRole.STUDENT],
    request: { body: CreateRecurringSlotBody },
    responses: {
      201: z.object({
        success: z.literal(true),
        data: z.object({ slot: RecurringSlot, occurrences: z.array(GeneratedOccurrence) }),
      }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/v1/recurring-slots',
    summary: 'Own recurring slots (student/teacher); admin sees all',
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(RecurringSlot) }),
      401: ErrorEnvelope,
    },
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/v1/recurring-slots/:id',
    summary: 'Prospective-only edit to the series template; never touches already-generated appointments',
    access: 'authenticated',
    request: { params: z.object({ id: z.string() }), body: UpdateRecurringSlotBody },
    responses: {
      200: z.object({ success: z.literal(true), data: RecurringSlot }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  cancel: defineContract({
    method: 'PATCH',
    path: '/api/v1/recurring-slots/:id/cancel',
    summary:
      'Deactivates the series; individual occurrences must be cancelled separately via the existing appointment flow',
    access: 'authenticated',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: RecurringSlot }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
