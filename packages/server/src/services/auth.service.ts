import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { sendPasswordResetEmail, sendWelcomeEmail } from './email.service';
import { logger } from '../lib/logger';
import { disconnectUserSockets } from './socket.service';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
};

export const verifyToken = (token: string): { userId: string; role: string } | null => {
  try {
    return jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
  } catch {
    return null;
  }
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const hashRefreshToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const verifyRefreshToken = (token: string, storedHash: string | null): boolean => {
  if (!storedHash) return false;
  const computedHash = hashRefreshToken(token);
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
};

export const registerUser = async (
  email: string,
  password: string,
  role: 'STUDENT' | 'TEACHER',
  firstName: string,
  lastName: string
) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) throw new AppError(409, 'Email already registered');
  if (existing?.deletedAt) throw new AppError(409, 'This email has been used by a deleted account. Contact support.');
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role, firstName, lastName },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true },
  });
  sendWelcomeEmail(user.email, user.firstName).catch((err) => logger.error({ err }, 'Welcome email failed'));
  return user;
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError(401, 'Invalid credentials');
  }
  if (user.deletedAt) throw new AppError(403, 'Account has been deleted. Contact support.');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'Account is not active. Please wait for admin approval.');
  const token = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken();
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashRefreshToken(refreshToken) } });
  return { user, token, refreshToken };
};

export const refreshSession = async (refreshToken: string) => {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const user = await prisma.user.findFirst({ where: { refreshTokenHash } });
  if (!user || !verifyRefreshToken(refreshToken, user.refreshTokenHash)) {
    throw new AppError(401, 'Invalid refresh token');
  }
  if (user.deletedAt) throw new AppError(401, 'Account has been deleted');
  if (user.status !== 'ACTIVE') throw new AppError(401, 'Account is not active');
  const token = generateToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken();
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashRefreshToken(newRefreshToken) } });
  return { token, refreshToken: newRefreshToken };
};

export const logoutUser = async (userId: string): Promise<void> => {
  // Clearing deviceToken too: a signed-out phone must not keep receiving this user's pushes.
  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null, deviceToken: null } });
};

export const verifyUserEmail = async (userId: string) => {
  return prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
};

export const resendVerificationEmail = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
  if (!user) throw new AppError(404, 'User not found');
  await sendWelcomeEmail(user.email, user.firstName);
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true, email: true, firstName: true },
  });

  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiry = new Date(Date.now() + 3_600_000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: hash, passwordResetExpiry: expiry },
  });

  sendPasswordResetEmail(user.email, user.firstName, token).catch((err) =>
    logger.error({ err }, 'Password reset email failed')
  );

  if (config.env !== 'production') {
    logger.info({ userId: user.id }, 'Password reset email sent (dev)');
  }
};

export const resetPassword = async (token: string, newPassword: string) => {
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hash,
      passwordResetExpiry: { gt: new Date() },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!user) throw new AppError(400, 'Invalid or expired reset token');

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      passwordResetToken: null,
      passwordResetExpiry: null,
      refreshTokenHash: null,
    },
  });
  disconnectUserSockets(user.id); // a reset ends every live session too

  return { message: 'Password reset successfully' };
};
