import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, JsonWebTokenError } from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { config } from '../config';
import { UserRole } from '@quran-review/shared';
import { AppError } from './error.middleware';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'));
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.userId = payload.sub || payload.userId;
    req.userRole = payload.role;

    // Validate user still exists, is active, and hasn't been banned/deleted
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, role: true, status: true, deletedAt: true, passwordChangedAt: true },
    });
    if (!user) {
      next(new AppError(401, 'User not found'));
      return;
    }
    if (user.deletedAt) {
      next(new AppError(401, 'Account has been deleted'));
      return;
    }
    if (user.status === 'BANNED') {
      next(new AppError(401, 'Account has been banned'));
      return;
    }

    // Invalidate tokens issued before last password change (compare in whole seconds)
    if (payload.iat && user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
      next(new AppError(401, 'Token invalidated by password change'));
      return;
    }

    next();
  } catch (err) {
    next(err instanceof JsonWebTokenError ? new AppError(401, 'Invalid or expired token') : err);
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole as UserRole)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
};
