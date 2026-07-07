import { z } from 'zod';
import { defineContract, ErrorEnvelope } from './types';
import { UserRole } from '../enums/roles';

const TriggerType = z.enum([
  'SURAH_COUNT',
  'REVISION_COUNT',
  'STREAK_LENGTH',
  'PLAN_COMPLETION',
  'IJAZAH_ISSUED',
  'HALAQA_ATTENDANCE_COUNT',
]);

const MilestoneDefinition = z.looseObject({
  id: z.string(),
  badgeCode: z.string(),
  triggerType: TriggerType,
  threshold: z.number(),
  active: z.boolean(),
  badge: z.looseObject({ code: z.string(), name: z.string(), description: z.string(), iconKey: z.string() }),
});

const CreateMilestoneBody = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  iconKey: z.string().min(1),
  triggerType: TriggerType,
  threshold: z.number().int().positive(),
});

export const milestonesContracts = {
  create: defineContract({
    method: 'POST',
    path: '/api/v1/milestones',
    summary: 'An admin defines a new milestone — name plus a trigger from a supported set — without a code deploy',
    access: [UserRole.ADMIN],
    request: { body: CreateMilestoneBody },
    responses: {
      201: z.object({ success: z.literal(true), data: MilestoneDefinition }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/v1/milestones',
    summary: 'The full milestone catalog (admin management view)',
    access: [UserRole.ADMIN],
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(MilestoneDefinition) }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
};
