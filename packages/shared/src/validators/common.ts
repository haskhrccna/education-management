import * as z from 'zod';

export const passwordSchema = z.string().min(8).max(100);
export const emailSchema = z.string().email().max(255);
export const nameSchema = z.string().min(1).max(100);
export const fileNameSchema = z.string().min(1).max(255);

export const LoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['student', 'teacher']),
  firstName: nameSchema,
  lastName: nameSchema,
});

export type ZodLoginInput = z.infer<typeof LoginSchema>;
export type ZodRegisterInput = z.infer<typeof RegisterSchema>;
