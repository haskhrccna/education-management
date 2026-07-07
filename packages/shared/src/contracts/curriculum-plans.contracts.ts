import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';

const PlanItem = z.looseObject({
  id: z.string(),
  surahId: z.number(),
  targetDate: DateOut,
  order: z.number(),
});

const Plan = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
  items: z.array(PlanItem),
  pace: z.enum(['ON_PACE', 'BEHIND', 'AHEAD']),
});

const CreatePlanBody = z.object({
  studentId: z.string(),
  name: z.string().min(1),
  items: z.array(z.object({ surahId: z.number(), targetDate: z.string() })).min(1, 'A plan needs at least one surah'),
});

export const curriculumPlansContracts = {
  create: defineContract({
    method: 'POST',
    path: '/api/v1/curriculum-plans',
    summary: 'A teacher creates a named plan for a student: an ordered list of surahs with a target date each',
    access: [UserRole.TEACHER],
    request: { body: CreatePlanBody },
    responses: {
      201: z.object({ success: z.literal(true), data: Plan }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/v1/curriculum-plans',
    summary: "Own plans (student); a teacher's own students' plans (teacher); all (admin) — each with a pace verdict",
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(Plan) }),
      401: ErrorEnvelope,
    },
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/v1/curriculum-plans/:id',
    summary: 'One plan with its items and pace verdict',
    access: 'authenticated',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: Plan }),
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
