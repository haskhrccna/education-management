import { z } from 'zod';
import { defineContract } from './types';

const HealthData = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  version: z.string(),
  checks: z.object({
    database: z.object({ status: z.enum(['up', 'down']), latencyMs: z.number() }),
    redis: z.object({ status: z.enum(['up', 'down', 'disabled']) }).optional(),
    memory: z.object({ status: z.literal('up'), usedMB: z.number(), totalMB: z.number() }),
  }),
});

/** getHealthStatus() wrapped by successResponse — the one enveloped success in this pilot. */
const HealthEnvelope = z.object({ success: z.literal(true), data: HealthData });

export const healthContracts = {
  getHealth: defineContract({
    method: 'GET',
    path: '/api/health',
    summary: 'Liveness/readiness probe (DB + memory checks)',
    access: 'public',
    responses: { 200: HealthEnvelope, 503: HealthEnvelope },
  }),
};
