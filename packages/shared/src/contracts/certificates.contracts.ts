import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';

const Certificate = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  pdfUrl: z.string(),
  issuedAt: DateOut,
  verificationToken: z.string(),
  active: z.boolean(),
});

export const certificatesContracts = {
  listCertificates: defineContract({
    method: 'GET',
    path: '/api/v1/certificates',
    summary: 'STUDENT ⇒ own; ADMIN ⇒ all or ?studentId=; others 403 (pinned message)',
    access: 'authenticated',
    responses: {
      200: z.looseObject({
        success: z.literal(true),
        data: z.array(
          Certificate.extend({
            student: z.looseObject({ id: z.string(), firstName: z.string(), lastName: z.string() }),
          })
        ),
      }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  regenerateLink: defineContract({
    method: 'PATCH',
    path: '/api/v1/certificates/:id/regenerate-link',
    summary: 'Student revokes their current verification link and gets a fresh one, e.g. after sharing it in error',
    access: [UserRole.STUDENT],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: Certificate }),
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
