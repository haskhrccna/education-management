import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const reqId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).reqId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
};
