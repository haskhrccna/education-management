import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const DeviceTokenSchema = z.object({
  deviceToken: z.string().min(1).max(1024),
});
