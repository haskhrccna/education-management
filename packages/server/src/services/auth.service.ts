import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { sendPasswordResetEmail } from './email.service';
import { logger } from '../lib/logger';

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

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      refreshTokenHash: null,
    },
  });

  return { message: 'Password reset successfully' };
};
