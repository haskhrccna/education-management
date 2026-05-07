import { ZodSchema, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

export const validate =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.validatedData = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map((i) => `${i.path.join('.')}${': ' + i.message}`);
        next(new AppError(400, messages.join('; ')));
      } else {
        next(err);
      }
    }
  };

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      validatedData?: unknown;
    }
  }
}
