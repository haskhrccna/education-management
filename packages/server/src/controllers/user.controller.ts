import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { hashPassword } from '../services/auth.service';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../lib/logger';

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    // Mobile expects lowercase role/status; server-internal canonical is uppercase.
    res.json({ ...user, role: user.role.toLowerCase(), status: user.status.toLowerCase() });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName } = req.body;
    const data: Record<string, string> = {};
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data,
      select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true, createdAt: true },
    });
    res.json({ ...user, role: user.role.toLowerCase(), status: user.status.toLowerCase() });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new AppError(404, 'User not found');

    const bcrypt = await import('bcryptjs');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(401, 'Current password is incorrect');
    }

    const hash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: req.userId! },
      data: { passwordHash: hash, passwordChangedAt: new Date() },
    });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

export const saveDeviceToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { deviceToken } = req.body;
    if (!deviceToken) throw new AppError(400, 'deviceToken is required');

    await prisma.user.update({
      where: { id: req.userId! },
      data: { deviceToken },
    });

    logger.info({ userId: req.userId, token: deviceToken.slice(0, 20) }, 'Device token saved to DB');
    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
};
