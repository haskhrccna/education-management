import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/auth.service', () => ({
  hashPassword: jest.fn().mockResolvedValue('new-hashed-password'),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { prisma } from '../../prisma/client';
import bcrypt from 'bcryptjs';
import { listTeachers, getProfile, updateProfile, changePassword, saveDeviceToken } from '../user.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function createApp(userId = 'user-1', userRole = 'STUDENT') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.get('/teachers', listTeachers);
  app.get('/profile', getProfile);
  app.patch('/profile', updateProfile);
  app.post('/change-password', changePassword);
  app.post('/device-token', saveDeviceToken);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('user.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /teachers', () => {
    it('lists active teachers in alphabetical order', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 't-1', firstName: 'Ahmed', lastName: 'Ali' }] as any);

      const res = await request(createApp()).get('/teachers');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'TEACHER', status: 'ACTIVE', deletedAt: null },
        })
      );
    });
  });

  describe('GET /profile', () => {
    it('returns profile with lowercased role and status', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'STUDENT',
        status: 'ACTIVE',
        firstName: 'Ali',
        lastName: 'Hassan',
        emailVerifiedAt: null,
        createdAt: new Date('2026-01-01'),
        assignedTeacher: null,
        assignedStudents: [],
      } as any);

      const res = await request(createApp()).get('/profile');

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('student');
      expect(res.body.status).toBe('active');
      expect(res.body.email).toBe('test@test.com');
    });

    it('returns 404 when user is not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/profile');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /profile', () => {
    it('updates firstName and lastName', async () => {
      mockedPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'STUDENT',
        status: 'ACTIVE',
        firstName: 'NewFirst',
        lastName: 'NewLast',
        createdAt: new Date(),
      } as any);

      const res = await request(createApp()).patch('/profile').send({ firstName: 'NewFirst', lastName: 'NewLast' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('NewFirst');
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { firstName: 'NewFirst', lastName: 'NewLast' },
        })
      );
    });

    it('only updates provided fields (partial update)', async () => {
      mockedPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        role: 'STUDENT',
        status: 'ACTIVE',
        createdAt: new Date(),
      } as any);

      await request(createApp()).patch('/profile').send({ firstName: 'OnlyFirst' });

      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { firstName: 'OnlyFirst' } })
      );
    });
  });

  describe('POST /change-password', () => {
    it('changes password when current password is correct', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      } as any);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1' } as any);

      const res = await request(createApp()).post('/change-password').send({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password changed successfully');
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: 'new-hashed-password',
            passwordChangedAt: expect.any(Date),
          }),
        })
      );
    });

    it('returns 404 when user is not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/change-password').send({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });
      expect(res.status).toBe(404);
    });

    it('returns 401 when current password is wrong', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      } as any);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const res = await request(createApp()).post('/change-password').send({
        currentPassword: 'WrongPass!',
        newPassword: 'NewPass456!',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /device-token', () => {
    it('saves the device FCM token', async () => {
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1' } as any);

      const res = await request(createApp()).post('/device-token').send({ deviceToken: 'fcm-abc-123' });

      expect(res.status).toBe(200);
      expect(res.body.saved).toBe(true);
      expect(mockedPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deviceToken: 'fcm-abc-123' } })
      );
    });

    it('returns 400 when deviceToken is missing', async () => {
      const res = await request(createApp()).post('/device-token').send({});
      expect(res.status).toBe(400);
    });
  });
});
