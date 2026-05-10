import { Request, Response, NextFunction } from 'express';

const SENSITIVE_FIELDS = new Set(['password', 'passwordHash', 'tokenHash', 'authorization', 'apiKey', 'clientSecret']);

interface SanitizedRecord extends Record<string, unknown> {}

function sanitizeObject(obj: unknown): SanitizedRecord | string | number | boolean | null {
  if (!obj || typeof obj !== 'object') return obj as string | number | boolean | null;
  if (obj instanceof Date) return obj as unknown as SanitizedRecord;
  if (Buffer.isBuffer(obj)) return obj as unknown as SanitizedRecord;
  if (Array.isArray(obj)) return obj.map(sanitizeObject) as unknown as SanitizedRecord;

  const record = obj as Record<string, unknown>;
  const sanitized: SanitizedRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const sanitizeRequestBody = (_req: Request, _res: Response, next: NextFunction): void => {
  // Request body sanitization is a no-op: no controller reads req.sanitizedBody.
  // Response sanitization (sanitizeResponse) remains active.
  next();
};

export const sanitizeResponse = (_req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);
  res.json = function <T>(body: T): Response<T> {
    if (body && typeof body === 'object') {
      return originalJson(sanitizeObject(body));
    }
    return originalJson(body);
  };
  next();
};
