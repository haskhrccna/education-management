import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, JsonWebTokenError } from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { config } from '../config';
import { UserRole } from '@quran-review/shared';
import { AppError } from './error.middleware';

/**
 * The one account check behind every access token, shared by HTTP
 * (authenticate / fileAuthenticate) and the Socket.IO handshake: a valid
 * signature is not enough. The user must still exist, not be deleted or
 * banned, and the token must postdate the last password change.
 * Throws AppError(401) otherwise.
 */
export async function validateAccessToken(
  token: string
): Promise<{ userId: string; role: UserRole | string; expiresAt?: number }> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch (err) {
    throw err instanceof JsonWebTokenError ? new AppError(401, 'Invalid or expired token') : err;
  }
  const userId = payload.sub || payload.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, deletedAt: true, passwordChangedAt: true },
  });
  if (!user) throw new AppError(401, 'User not found');
  if (user.deletedAt) throw new AppError(401, 'Account has been deleted');
  if (user.status === 'BANNED') throw new AppError(401, 'Account has been banned');
  if (payload.iat && user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
    throw new AppError(401, 'Token invalidated by password change');
  }
  // Role comes from the DB row, never the token's claim: a demoted account
  // must lose its old authority on the next request, not at token expiry.
  return { userId: user.id, role: user.role, expiresAt: payload.exp };
}

async function resolveAndValidateToken(token: string, req: Request, next: NextFunction): Promise<boolean> {
  try {
    const { userId, role } = await validateAccessToken(token);
    req.userId = userId;
    req.userRole = role as typeof req.userRole;
    return true;
  } catch (err) {
    next(err);
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
