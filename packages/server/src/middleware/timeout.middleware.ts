import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

const DEFAULT_TIMEOUT_MS = 30000;

export const timeout = (ms: number = DEFAULT_TIMEOUT_MS) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        next(new AppError(504, `Request timeout after ${ms}ms`));
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
};
