import { z } from 'zod';
import { defineContract, ErrorEnvelope } from './types';
import { UserRole } from '../enums/roles';

export const parentLinksContracts = {
  setDigestPreference: defineContract({
    method: 'PATCH',
    path: '/api/v1/parent-links/:id/digest-preference',
    summary: "A parent opts a specific child's weekly digest on/off. 404s if the link isn't the caller's.",
    access: [UserRole.PARENT],
    request: {
      params: z.object({ id: z.string() }),
      body: z.object({ digestOptOut: z.boolean() }),
    },
    responses: {
      200: z.looseObject({ id: z.string(), digestOptOut: z.boolean() }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
