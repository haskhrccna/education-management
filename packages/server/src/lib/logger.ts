import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  transport: config.env === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  base: { service: 'education-api' },
});

interface TrackedRequest extends Request {
  reqId?: string;
}

// File downloads authenticate via ?token=<JWT> (browser cannot set headers) —
// never persist that credential into the request log (M13 security review).
const redactUrl = (url: string) => url.replace(/([?&]token=)[^&]+/gi, '$1[REDACTED]');

export const requestLogger = (req: TrackedRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const url = redactUrl(req.originalUrl);
    logger.info(
      {
        reqId: req.reqId,
        method: req.method,
        url,
        statusCode: res.statusCode,
        durationMs: duration,
        userId: req.userId,
      },
      `${req.method} ${url} ${res.statusCode}`
    );
  });
  next();
};
