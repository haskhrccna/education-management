import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const reqId = (req as any).reqId;

  if (err instanceof AppError) {
    logger.warn({ reqId, statusCode: err.statusCode, message: err.message }, 'AppError');
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  logger.error({ reqId, err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ success: false, error: 'Internal server error' });
};
