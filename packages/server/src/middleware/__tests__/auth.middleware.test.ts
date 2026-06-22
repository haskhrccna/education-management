import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { config } from '../../config';
import { authenticate, fileAuthenticate, authorize } from '../auth.middleware';
import { UserRole } from '@quran-review/shared';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

function signToken(payload: object, opts: jwt.SignOptions = {}): string {
  return jwt.sign(payload, config.jwtSecret, opts);
}

function appWith(mw: express.RequestHandler) {
  const app = express();
  app.get('/protected', mw, (req: any, res) => {
    res.json({ userId: req.userId, userRole: req.userRole });
  });
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

const activeUser = {
  id: 'user-1',
  role: 'STUDENT',
  status: 'ACTIVE',
  deletedAt: null,
  passwordChangedAt: null,
};

describe('auth.middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('attaches userId/userRole and calls next for a valid token', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(activeUser as any);
      const token = signToken({ userId: 'user-1', role: 'STUDENT' });

      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user-1');
      expect(res.body.userRole).toBe('STUDENT');
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(appWith(authenticate)).get('/protected');
      expect(res.status).toBe(401);
    });

    it('returns 401 when header does not start with Bearer', async () => {
      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', 'Token abc');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed/invalid token', async () => {
      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', 'Bearer not-a-jwt');
      expect(res.status).toBe(401);
    });

    it('returns 401 when the user no longer exists', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      const token = signToken({ userId: 'ghost', role: 'STUDENT' });

      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('returns 401 when the account is soft-deleted', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ ...activeUser, deletedAt: new Date() } as any);
      const token = signToken({ userId: 'user-1', role: 'STUDENT' });

      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/deleted/i);
    });

    it('returns 401 when the account is banned', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'BANNED' } as any);
      const token = signToken({ userId: 'user-1', role: 'STUDENT' });

      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/banned/i);
    });

    it('returns 401 when the token was issued before a password change', async () => {
      const pastIat = Math.floor(Date.now() / 1000) - 3600;
      mockedPrisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        passwordChangedAt: new Date(),
      } as any);
      const token = signToken({ userId: 'user-1', role: 'STUDENT', iat: pastIat });

      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/password change/i);
    });

    it('resolves userId from the sub claim when userId is absent', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(activeUser as any);
      const token = signToken({ sub: 'user-1', role: 'STUDENT' });

      const res = await request(appWith(authenticate)).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user-1');
    });
  });

  describe('fileAuthenticate', () => {
    it('accepts a token via the ?token= query param', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(activeUser as any);
      const token = signToken({ userId: 'user-1', role: 'STUDENT' });

      const res = await request(appWith(fileAuthenticate)).get(`/protected?token=${token}`);
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user-1');
    });

    it('accepts a token via the Authorization header', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(activeUser as any);
      const token = signToken({ userId: 'user-1', role: 'STUDENT' });

      const res = await request(appWith(fileAuthenticate)).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('returns 401 when neither header nor query token is present', async () => {
      const res = await request(appWith(fileAuthenticate)).get('/protected');
      expect(res.status).toBe(401);
    });
  });

  describe('authorize', () => {
    function appWithRole(role: string | undefined, ...allowed: UserRole[]) {
      const app = express();
      app.get(
        '/admin',
        (req: any, _res, next) => {
          if (role !== undefined) req.userRole = role;
          next();
        },
        authorize(...allowed),
        (_req, res) => res.json({ ok: true })
      );
      app.use((err: any, _req: any, res: any, _next: any) =>
        res.status(err.statusCode || 500).json({ error: err.message })
      );
      return app;
    }

    it('allows a caller whose role is in the allow-list', async () => {
      const res = await request(appWithRole('ADMIN', UserRole.ADMIN)).get('/admin');
      expect(res.status).toBe(200);
    });

    it('rejects a caller whose role is not in the allow-list', async () => {
      const res = await request(appWithRole('STUDENT', UserRole.ADMIN)).get('/admin');
      expect(res.status).toBe(403);
    });

    it('rejects a caller with no role at all', async () => {
      const res = await request(appWithRole(undefined, UserRole.ADMIN)).get('/admin');
      expect(res.status).toBe(403);
    });
  });
});
