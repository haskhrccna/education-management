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

    // Invalidate tokens issued before last password change
    if (payload.iat) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { passwordChangedAt: true },
      });
      if (user?.passwordChangedAt && new Date(payload.iat * 1000) < user.passwordChangedAt) {
        next(new AppError(401, 'Token invalidated by password change'));
        return;
      }
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
