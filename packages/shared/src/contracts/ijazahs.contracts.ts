import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { UserRole } from '../enums/roles';

const Scope = z.enum(['SURAH', 'JUZ', 'FULL_QURAN']);

const Ijazah = z.looseObject({
  id: z.string(),
  studentId: z.string(),
  teacherId: z.string(),
  scope: Scope,
  surahId: z.number().nullable(),
  juzNumber: z.number().nullable(),
  teacherChainRef: z.string().nullable(),
  chainIjazahId: z.string().nullable(),
  issuedAt: DateOut,
});

const IssueIjazahBody = z.object({
  studentId: z.string(),
  scope: Scope,
  surahId: z.number().optional(),
  juzNumber: z.number().optional(),
  teacherChainRef: z.string().optional(),
  chainIjazahId: z.string().optional(),
});

export const ijazahsContracts = {
  issue: defineContract({
    method: 'POST',
    path: '/api/v1/ijazahs',
    summary:
      "A teacher formally endorses a student's completed portion (surah/juz/full Quran) as a dated, attributed ijazah",
    access: [UserRole.TEACHER],
    request: { body: IssueIjazahBody },
    responses: {
      201: z.object({ success: z.literal(true), data: Ijazah }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/v1/ijazahs',
    summary: "Own ijazahs (student); a teacher's own issued (teacher); all (admin, for program-wide audit)",
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(Ijazah) }),
      401: ErrorEnvelope,
    },
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/v1/ijazahs/:id',
    summary: 'One ijazah record with its sanad chain',
    access: 'authenticated',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: Ijazah }),
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
