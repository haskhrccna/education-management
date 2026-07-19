import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { LoginSchema, RegisterSchema, RefreshTokenSchema } from '../validators/common';
import { ForgotPasswordSchema, ResetPasswordSchema } from '../validators/auth';

const Message = z.object({ message: z.string() });

/** register echoes the raw Prisma select — UPPERCASE role/status, no envelope. */
const RegisteredUser = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['STUDENT', 'TEACHER']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'BANNED']),
});

/** login lowercases role/status for the mobile client. */
const SessionUser = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['student', 'teacher', 'admin', 'parent']),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(['pending', 'approved', 'active', 'banned']),
  // F5: null → first-run onboarding wizard shows on the client.
  onboardingCompletedAt: DateOut.nullable(),
});

export const authContracts = {
  register: defineContract({
    method: 'POST',
    path: '/api/v1/auth/register',
    summary: 'Self-register a student or teacher (lands in PENDING)',
    access: 'public',
    request: { body: RegisterSchema },
    responses: {
      201: z.object({ message: z.string(), user: RegisteredUser }),
      400: ErrorEnvelope,
      409: ErrorEnvelope,
    },
  }),
  login: defineContract({
    method: 'POST',
    path: '/api/v1/auth/login',
    summary: 'Email+password login → JWT access + refresh token',
    access: 'public',
    request: { body: LoginSchema },
    responses: {
      200: z.object({ message: z.string(), user: SessionUser, token: z.string(), refreshToken: z.string() }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
    },
  }),
  refresh: defineContract({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    summary: 'Rotate refresh token → new JWT pair',
    access: 'public',
    request: { body: RefreshTokenSchema },
    responses: {
      200: z.object({ token: z.string(), refreshToken: z.string() }),
      400: ErrorEnvelope,
      401: ErrorEnvelope,
    },
  }),
  logout: defineContract({
    method: 'POST',
    path: '/api/v1/auth/logout',
    summary: 'Invalidate the stored refresh token',
    access: 'authenticated',
    responses: { 204: z.undefined(), 401: ErrorEnvelope },
  }),
  verifyEmail: defineContract({
    method: 'POST',
    path: '/api/v1/auth/verify-email',
    summary: 'Mark the authenticated user email as verified',
    access: 'authenticated',
    responses: {
      200: z.object({ message: z.string(), status: z.enum(['PENDING', 'APPROVED', 'ACTIVE', 'BANNED']) }),
      401: ErrorEnvelope,
    },
  }),
  resendVerification: defineContract({
    method: 'POST',
    path: '/api/v1/auth/resend-verification',
    summary: 'Resend the welcome/verification email',
    access: 'authenticated',
    responses: { 200: Message, 401: ErrorEnvelope, 404: ErrorEnvelope },
  }),
  forgotPassword: defineContract({
    method: 'POST',
    path: '/api/v1/auth/forgot-password',
    summary: 'Request password-reset email (never reveals registration)',
    access: 'public',
    request: { body: ForgotPasswordSchema },
    responses: { 200: Message, 400: ErrorEnvelope },
  }),
  resetPassword: defineContract({
    method: 'POST',
    path: '/api/v1/auth/reset-password',
    summary: 'Reset password with the emailed token',
    access: 'public',
    request: { body: ResetPasswordSchema },
    responses: { 200: Message, 400: ErrorEnvelope },
  }),
};
