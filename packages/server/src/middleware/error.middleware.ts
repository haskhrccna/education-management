import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.warn({ reqId: (req as any).reqId, statusCode: err.statusCode, err: err.message }, 'AppError');
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logger.error({ reqId: (req as any).reqId, err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};
