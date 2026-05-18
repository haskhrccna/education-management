import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, JsonWebTokenError } from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { config } from '../config';
import { UserRole } from '@quran-review/shared';
import { AppError } from './error.middleware';

async function resolveAndValidateToken(token: string, req: Request, next: NextFunction): Promise<boolean> {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.userId = payload.sub || payload.userId;
    req.userRole = payload.role;

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, role: true, status: true, deletedAt: true, passwordChangedAt: true },
    });
    if (!user) {
      next(new AppError(401, 'User not found'));
      return false;
    }
    if (user.deletedAt) {
      next(new AppError(401, 'Account has been deleted'));
      return false;
    }
    if (user.status === 'BANNED') {
      next(new AppError(401, 'Account has been banned'));
      return false;
    }
    if (payload.iat && user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
      next(new AppError(401, 'Token invalidated by password change'));
      return false;
    }
    return true;
  } catch (err) {
    next(err instanceof JsonWebTokenError ? new AppError(401, 'Invalid or expired token') : err);
    return false;
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'));
    return;
  }
  const ok = await resolveAndValidateToken(header.slice(7), req, next);
  if (ok) next();
};

/** For file-download routes only: also accepts JWT via ?token= query param (browser cannot set headers). */
export const fileAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
  if (!header?.startsWith('Bearer ') && !queryToken) {
    next(new AppError(401, 'Authentication required'));
    return;
  }
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken!;
  const ok = await resolveAndValidateToken(token, req, next);
  if (ok) next();
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
