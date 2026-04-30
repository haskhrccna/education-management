import { Request, Response, NextFunction } from 'express';

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'authorization', 'apiKey', 'secret'];

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const sanitizeRequestBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    (req as any).sanitizedBody = sanitizeObject(req.body);
  }
  next();
};

export const sanitizeResponse = (_req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (body && typeof body === 'object') {
      return originalJson(sanitizeObject(body));
    }
    return originalJson(body);
  };
  next();
};
