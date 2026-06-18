import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
} from '../services/auth.service';
import { AppError } from '../middleware/error.middleware';
import { sendWelcomeEmail } from '../services/email.service';
import { logger } from '../lib/logger';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, role, firstName, lastName } = req.body;
    // RegisterSchema validates role ∈ ['student', 'teacher', 'parent'].
    // Map the lowercase body value to the UPPERCASE Prisma enum.
    const prismaRole = (role as string).toUpperCase() as 'STUDENT' | 'TEACHER' | 'PARENT';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) {
      throw new AppError(409, 'Email already registered');
    }
    if (existing?.deletedAt) {
      throw new AppError(409, 'This email has been used by a deleted account. Contact support.');
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: prismaRole, firstName, lastName },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true },
    });

    // Send welcome email asynchronously
    sendWelcomeEmail(user.email, user.firstName).catch((err) => logger.error({ err }, 'Welcome email failed'));

    res.status(201).json({ message: 'Registration successful. Awaiting admin approval.', user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid credentials');
    }
    if (user.deletedAt) {
      throw new AppError(403, 'Account has been deleted. Contact support.');
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'Account is not active. Please wait for admin approval.');
    }
    const token = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash } });

    const userInfo = {
      id: user.id,
      email: user.email,
      // Mobile client types role/status as lowercase. Server-internal canonical
      // is uppercase (Prisma enum, JWT payload, authorize() guards).
      role: user.role.toLowerCase(),
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status.toLowerCase(),
    };
    res.json({ message: 'Login successful', user: userInfo, token, refreshToken });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError(400, 'refreshToken is required');

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const user = await prisma.user.findFirst({ where: { refreshTokenHash } });
    if (!user || !verifyRefreshToken(refreshToken, user.refreshTokenHash)) {
      throw new AppError(401, 'Invalid refresh token');
    }
    if (user.deletedAt) {
      throw new AppError(401, 'Account has been deleted');
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(401, 'Account is not active');
    }

    const token = generateToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: newRefreshTokenHash } });

    res.json({ token, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    res.json({ message: 'Email verified', status: user.status });
  } catch (err) {
    next(err);
  }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
    if (!user) throw new AppError(404, 'User not found');

    await sendWelcomeEmail(user.email, user.firstName);
    res.json({ message: 'Verification email resent' });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: req.userId! },
      data: { refreshTokenHash: null },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await forgotPasswordService(req.body.email);
    res.json({ message: 'If that email is registered, a password reset link has been sent' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await resetPasswordService(req.body.token, req.body.newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
