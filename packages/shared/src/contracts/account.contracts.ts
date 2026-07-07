import { z } from 'zod';
import { defineContract, ErrorEnvelope } from './types';

export const accountContracts = {
  exportMyData: defineContract({
    method: 'GET',
    path: '/api/v1/account/data-export',
    summary:
      'Every record the platform holds about the caller — GDPR/COPPA data portability. Scoped to the caller only.',
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.record(z.string(), z.unknown()) }),
      401: ErrorEnvelope,
    },
  }),
  deleteMyAccount: defineContract({
    method: 'DELETE',
    path: '/api/v1/account',
    summary: 'Self-service account deletion — anonymizes PII while preserving relational integrity, same as admin.',
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.object({ id: z.string(), deleted: z.literal(true) }) }),
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
