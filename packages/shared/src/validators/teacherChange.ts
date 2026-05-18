import { z } from 'zod';

export const SubmitTeacherChangeSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

export const DecideTeacherChangeSchema = z
  .object({
    action: z.enum(['APPROVE', 'DENY']),
    adminNote: z.string().max(500).optional(),
    newTeacherId: z.string().uuid().optional(),
  })
  .refine((data) => data.action !== 'APPROVE' || !!data.newTeacherId, {
    message: 'newTeacherId (UUID) is required when action is APPROVE',
    path: ['newTeacherId'],
  });
