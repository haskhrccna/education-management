import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/auth.service', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  comparePassword: jest.fn().mockResolvedValue(true),
  generateToken: jest.fn().mockReturnValue('test-token'),
  generateRefreshToken: jest.fn().mockReturnValue('test-refresh-token'),
}));

import { prisma } from '../../prisma/client';
import * as authService from '../../services/auth.service';
import { register, login, verifyEmail } from '../auth.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

const app = express();
app.use(express.json());
app.post('/register', register);
app.post('/login', login);
app.post('/verify-email', (req: any, res: any, next: any) => {
  req.userId = 'user-1';
  next();
}, verifyEmail);

describe('auth.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should create PENDING student without token', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'STUDENT',
        status: 'PENDING',
      } as any);

      const res = await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'Password123!', role: 'student', firstName: 'Test', lastName: 'User' });

      expect(res.status).toBe(201);
      expect(res.body.user.status).toBe('PENDING');
      expect(res.body.token).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'existing' } as any);

      const res = await request(app)
        .post('/register')
        .send({ email: 'existing@test.com', password: 'Password123!', role: 'student', firstName: 'Test', lastName: 'User' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /login', () => {
    it('should login ACTIVE user and return token', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'active@test.com',
        passwordHash: 'hashed',
        role: 'STUDENT',
        status: 'ACTIVE',
        firstName: 'Active',
        lastName: 'User',
      } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1' } as any);

      const res = await request(app)
        .post('/login')
        .send({ email: 'active@test.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBe('test-token');
      expect(res.body.user.status).toBe('ACTIVE');
    });

    it('should reject PENDING user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'pending@test.com',
        passwordHash: 'hashed',
        role: 'STUDENT',
        status: 'PENDING',
      } as any);

      const res = await request(app)
        .post('/login')
        .send({ email: 'pending@test.com', password: 'Password123!' });

      expect(res.status).toBe(403);
    });

    it('should reject invalid credentials', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/login')
        .send({ email: 'unknown@test.com', password: 'Password123!' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /verify-email', () => {
    it('should verify email without changing status', async () => {
      mockedPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        status: 'PENDING',
      } as any);

      const res = await request(app)
        .post('/verify-email')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ status: 'APPROVED' }),
        })
      );
    });
  });
});
