import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  transport: config.env === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  base: { service: 'education-api' },
});

export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      {
        reqId: req.reqId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        userId: req.userId,
      },
      `${req.method} ${req.originalUrl} ${res.statusCode}`
    );
  });
  next();
};
