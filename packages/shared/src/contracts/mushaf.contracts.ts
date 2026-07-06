import { z } from 'zod';
import { defineContract, ErrorEnvelope } from './types';
import { logAyahMemorizationSchema } from '../validators/mushaf';

const AyahRow = z.looseObject({ number: z.number(), surahId: z.number(), page: z.number(), juz: z.number() });

export const mushafContracts = {
  surahAyahs: defineContract({
    method: 'GET',
    path: '/api/v1/mushaf/surahs/:id',
    summary: 'One surah with its ayahs ordered by number ({success,data} envelope)',
    access: 'authenticated',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: z.looseObject({ id: z.number(), ayahs: z.array(AyahRow) }) }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  page: defineContract({
    method: 'GET',
    path: '/api/v1/mushaf/pages/:page',
    summary: 'One mushaf page: {page, juz, ayahs}',
    access: 'authenticated',
    request: { params: z.object({ page: z.string() }) },
    responses: {
      200: z.object({
        success: z.literal(true),
        data: z.object({ page: z.number(), juz: z.number(), ayahs: z.array(AyahRow) }),
      }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  logMemorization: defineContract({
    method: 'POST',
    path: '/api/v1/mushaf/log-memorization',
    summary: 'Self-service ayah-level memorization log (increments/decrements own progress)',
    access: 'authenticated',
    request: { body: logAyahMemorizationSchema },
    responses: {
      200: z.object({
        success: z.literal(true),
        data: z.object({ memorizedAyahs: z.number(), status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE']) }),
      }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
