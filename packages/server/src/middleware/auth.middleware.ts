import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '@edu/shared';
import { AppError } from './error.middleware';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'));
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string; role: UserRole };
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
};
