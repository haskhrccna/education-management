import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip || 'unknown'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 10,
  message: { error: 'Too many attempts, please try again later' },
  keyGenerator: (req) => {
    if (!req.userId) return ipKeyGenerator(req.ip || 'unknown');
    return req.userId;
  },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip || 'unknown'),
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads, please try again later' },
  keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip || 'unknown'),
});

export const broadcastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 1000 : 10,
  message: { error: 'Broadcast limit reached — maximum 10 broadcasts per hour' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip || 'unknown'),
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 3,
  message: { error: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req.ip || 'unknown'),
});
