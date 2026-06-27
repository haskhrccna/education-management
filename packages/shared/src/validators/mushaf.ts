import { z } from 'zod';

export const logAyahMemorizationSchema = z.object({
  surahId: z.number().int().positive(),
  ayahNumber: z.number().int().positive(),
  memorized: z.boolean(),
});
