import { authContracts } from '@quran-review/shared';
import { passwordResetLimiter } from '../../middleware/rate-limit.middleware';
import {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  verifyUserEmail,
  resendVerificationEmail,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
} from '../../services/auth.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

/** Prisma enums are UPPERCASE literal unions — Lowercase<> maps them to the mobile-facing case. */
const lc = <T extends string>(s: T) => s.toLowerCase() as Lowercase<T>;

const register = defineRoute(authContracts.register, async ({ body }) => {
  const prismaRole = body.role.toUpperCase() as 'STUDENT' | 'TEACHER';
  const user = await registerUser(body.email, body.password, prismaRole, body.firstName, body.lastName);
  return {
    status: 201 as const,
    body: {
      message: 'Registration successful. Awaiting admin approval.',
      user: {
        ...user,
        role: user.role as 'STUDENT' | 'TEACHER',
        status: user.status as 'PENDING' | 'APPROVED' | 'ACTIVE' | 'BANNED',
      },
    },
  };
});

const login = defineRoute(authContracts.login, async ({ body }) => {
  const { user, token, refreshToken } = await loginUser(body.email, body.password);
  return {
    status: 200 as const,
    body: {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: lc(user.role) as 'student' | 'teacher' | 'admin' | 'parent',
        firstName: user.firstName,
        lastName: user.lastName,
        status: lc(user.status) as 'pending' | 'approved' | 'active' | 'banned',
        onboardingCompletedAt: user.onboardingCompletedAt,
      },
      token,
      refreshToken,
    },
  };
});

const refresh = defineRoute(authContracts.refresh, async ({ body }) => {
  const { token, refreshToken } = await refreshSession(body.refreshToken);
  return { status: 200 as const, body: { token, refreshToken } };
});

const logout = defineRoute(authContracts.logout, async ({ userId }) => {
  await logoutUser(userId!);
  return { status: 204 as const, body: undefined };
});

const verifyEmail = defineRoute(authContracts.verifyEmail, async ({ userId }) => {
  const user = await verifyUserEmail(userId!);
  return {
    status: 200 as const,
    body: { message: 'Email verified', status: user.status as 'PENDING' | 'APPROVED' | 'ACTIVE' | 'BANNED' },
  };
});

const resendVerification = defineRoute(authContracts.resendVerification, async ({ userId }) => {
  await resendVerificationEmail(userId!);
  return { status: 200 as const, body: { message: 'Verification email resent' } };
});

const forgotPassword = defineRoute(
  authContracts.forgotPassword,
  async ({ body }) => {
    await forgotPasswordService(body.email);
    return {
      status: 200 as const,
      body: { message: 'If that email is registered, a password reset link has been sent' },
    };
  },
  { pre: [passwordResetLimiter] }
);

const resetPassword = defineRoute(
  authContracts.resetPassword,
  async ({ body }) => {
    const result = await resetPasswordService(body.token, body.newPassword);
    return { status: 200 as const, body: result };
  },
  { pre: [passwordResetLimiter] }
);

export const authRouter = buildContractRouter(
  [register, login, refresh, logout, verifyEmail, resendVerification, forgotPassword, resetPassword],
  { mountPrefix: '/api/v1/auth' }
);
