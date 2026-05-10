import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

import { errorResponse } from '../lib/response';

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const reqId = (req as any).reqId;

  if (res.headersSent) {
    logger.error({ reqId, err: err.message }, 'Error after response sent');
    return;
  }

  if (err instanceof AppError) {
    logger.warn({ reqId, statusCode: err.statusCode, message: err.message }, 'AppError');
    res.status(err.statusCode).json(errorResponse(err.message, { requestId: reqId }));
    return;
  }

  logger.error({ reqId, err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json(errorResponse('Internal server error', { requestId: reqId }));
};
