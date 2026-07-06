import { authContracts } from '@quran-review/shared';
import { prisma } from '../../prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { sendWelcomeEmail } from '../../services/email.service';
import { logger } from '../../lib/logger';
import { passwordResetLimiter } from '../../middleware/rate-limit.middleware';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
} from '../../services/auth.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

/** Prisma enums are UPPERCASE literal unions — Lowercase<> maps them to the mobile-facing case. */
const lc = <T extends string>(s: T) => s.toLowerCase() as Lowercase<T>;

const register = defineRoute(authContracts.register, async ({ body }) => {
  const prismaRole = body.role.toUpperCase() as 'STUDENT' | 'TEACHER';
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing && !existing.deletedAt) throw new AppError(409, 'Email already registered');
  if (existing?.deletedAt) throw new AppError(409, 'This email has been used by a deleted account. Contact support.');
  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: { email: body.email, passwordHash, role: prismaRole, firstName: body.firstName, lastName: body.lastName },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true },
  });
  sendWelcomeEmail(user.email, user.firstName).catch((err) => logger.error({ err }, 'Welcome email failed'));
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
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await comparePassword(body.password, user.passwordHash))) {
    throw new AppError(401, 'Invalid credentials');
  }
  if (user.deletedAt) throw new AppError(403, 'Account has been deleted. Contact support.');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'Account is not active. Please wait for admin approval.');
  const token = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashRefreshToken(refreshToken) } });
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
      },
      token,
      refreshToken,
    },
  };
});

const refresh = defineRoute(authContracts.refresh, async ({ body }) => {
  const refreshTokenHash = hashRefreshToken(body.refreshToken);
  const user = await prisma.user.findFirst({ where: { refreshTokenHash } });
  if (!user || !verifyRefreshToken(body.refreshToken, user.refreshTokenHash)) {
    throw new AppError(401, 'Invalid refresh token');
  }
  if (user.deletedAt) throw new AppError(401, 'Account has been deleted');
  if (user.status !== 'ACTIVE') throw new AppError(401, 'Account is not active');
  const token = generateToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken();
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashRefreshToken(newRefreshToken) } });
  return { status: 200 as const, body: { token, refreshToken: newRefreshToken } };
});

const logout = defineRoute(authContracts.logout, async ({ userId }) => {
  await prisma.user.update({ where: { id: userId! }, data: { refreshTokenHash: null } });
  return { status: 204 as const, body: undefined };
});

const verifyEmail = defineRoute(authContracts.verifyEmail, async ({ userId }) => {
  const user = await prisma.user.update({ where: { id: userId! }, data: { emailVerifiedAt: new Date() } });
  return {
    status: 200 as const,
    body: { message: 'Email verified', status: user.status as 'PENDING' | 'APPROVED' | 'ACTIVE' | 'BANNED' },
  };
});

const resendVerification = defineRoute(authContracts.resendVerification, async ({ userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { email: true, firstName: true },
  });
  if (!user) throw new AppError(404, 'User not found');
  await sendWelcomeEmail(user.email, user.firstName);
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
