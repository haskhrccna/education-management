import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut, rawResponse } from './types';

/** Public view of the academy — contactEmail is academy contact info, not student PII. */
export const AcademyProfilePublic = z
  .object({
    slug: z.string(),
    displayName: z.string(),
    publicBio: z.string().nullable(),
    programName: z.string(),
    logoUrl: z.string().nullable(),
    contactEmail: z.string().nullable(),
    updatedAt: DateOut,
  })
  .strict();

export const publicContracts = {
  getAcademyProfile: defineContract({
    method: 'GET',
    path: '/api/v1/public/academy/:slug',
    summary: 'Public academy landing profile; 404 when missing or inactive',
    access: 'public',
    request: { params: z.object({ slug: z.string() }) },
    responses: { 200: AcademyProfilePublic, 404: ErrorEnvelope },
  }),
  getShareImage: defineContract({
    method: 'GET',
    path: '/api/v1/public/verify/:token/share.png',
    summary: '1200×630 share PNG for a certificate/ijazah; 404 for unknown or revoked token',
    access: 'public',
    request: { params: z.object({ token: z.string() }) },
    responses: { 200: rawResponse('image/png'), 404: ErrorEnvelope },
  }),
};
