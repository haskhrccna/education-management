import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';

const WeakAyahFlag = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  ayahId: z.number(),
  flaggedByTeacherId: z.string().nullable(),
  status: z.enum(['ACTIVE', 'RETIRED']),
  consecutiveCorrect: z.number(),
  createdAt: DateOut,
});

export const weakAyahsContracts = {
  flag: defineContract({
    method: 'POST',
    path: '/api/v1/weak-ayahs',
    summary:
      'A teacher flags a specific ayah as weak for one of their students; seeds the first drill card through the existing SM-2 engine',
    access: [UserRole.TEACHER],
    request: { body: z.object({ studentId: z.string(), ayahId: z.number() }) },
    responses: {
      201: z.object({ success: z.literal(true), data: WeakAyahFlag }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/v1/weak-ayahs',
    summary: "Own active weak-ayah flags (student); a teacher's own students' (teacher); all (admin)",
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(WeakAyahFlag) }),
      401: ErrorEnvelope,
    },
  }),
};
