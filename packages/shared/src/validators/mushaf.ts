import { z } from 'zod';

export const logAyahMemorizationSchema = z.object({
  surahId: z.number().int().positive(),
  ayahNumber: z.number().int().positive(),
  memorized: z.boolean(),
});

export const PageStatusEnum = z.enum(['NOT_STARTED', 'LEARNING', 'MEMORIZED', 'SOLID']);

export const setPageStatusSchema = z.object({
  status: PageStatusEnum,
  studentId: z.string().uuid().optional(), // assigned teacher writing for their student
});
