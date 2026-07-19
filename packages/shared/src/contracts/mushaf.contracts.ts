import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { logAyahMemorizationSchema, PageStatusEnum, setPageStatusSchema } from '../validators/mushaf';

const PageMemorizationRow = z.looseObject({
  page: z.number(),
  status: PageStatusEnum,
  lastReviewedAt: DateOut.nullable(),
});

const AyahRow = z.looseObject({
  number: z.number(),
  surahId: z.number(),
  page: z.number(),
  juz: z.number(),
  audioUrl: z.string().nullable(),
});

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
  myPages: defineContract({
    method: 'GET',
    path: '/api/v1/mushaf/my-pages',
    summary:
      'All page-memorization statuses in one call (own; ?studentId= for assigned teacher / linked parent / admin)',
    access: 'authenticated',
    request: { query: z.object({ studentId: z.string().uuid().optional() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: z.array(PageMemorizationRow) }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  setPageStatus: defineContract({
    method: 'PUT',
    path: '/api/v1/mushaf/pages/:page/status',
    summary: 'Mark a mushaf page NOT_STARTED/LEARNING/MEMORIZED/SOLID (self, or assigned teacher via studentId)',
    access: 'authenticated',
    request: { params: z.object({ page: z.string() }), body: setPageStatusSchema },
    responses: {
      200: z.object({ success: z.literal(true), data: PageMemorizationRow }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  revisionQueue: defineContract({
    method: 'GET',
    path: '/api/v1/mushaf/revision-queue',
    summary:
      "Today's Sabaq/Sabqi/Manzil revision queue (own; ?studentId= for assigned teacher / linked parent / admin)",
    access: 'authenticated',
    request: { query: z.object({ studentId: z.string().uuid().optional() }) },
    responses: {
      200: z.object({
        success: z.literal(true),
        data: z.object({
          items: z.array(
            z.looseObject({
              page: z.number().nullable(),
              surahId: z.number().nullable(),
              band: z.enum(['OVERRIDE', 'MANZIL', 'SABQI', 'SABAQ']),
              overdueDays: z.number(),
            })
          ),
          reviewedThisWeek: z.number(),
        }),
      }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  pageReviewed: defineContract({
    method: 'POST',
    path: '/api/v1/mushaf/pages/:page/reviewed',
    summary: "Stamp a revision pass on a page (updates lastReviewedAt, drops it from today's queue)",
    access: 'authenticated',
    request: { params: z.object({ page: z.string() }) },
    responses: {
      200: z.object({ success: z.literal(true), data: z.looseObject({ page: z.number(), lastReviewedAt: DateOut }) }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
