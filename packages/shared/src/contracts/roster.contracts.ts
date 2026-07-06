import { z } from 'zod';
import { defineContract, ErrorEnvelope } from './types';
import { UserRole } from '../enums/roles';

const RosterHealthRow = z.object({
  studentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  atRisk: z.boolean(),
  reasons: z.array(z.enum(['MISSED_SESSIONS', 'STREAK_BROKEN', 'GRADE_GAP'])),
});

export const rosterContracts = {
  health: defineContract({
    method: 'GET',
    path: '/api/v1/roster/health',
    summary:
      "A teacher's own roster (students with an ACCEPTED appointment) with at-risk flags: 2+ consecutive " +
      'missed sessions, a streak broken this week, or no grade recorded from this teacher in 14 days.',
    access: [UserRole.TEACHER],
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(RosterHealthRow) }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
};
