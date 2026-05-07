import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/socket.service', () => ({
  sendToUser: jest.fn(),
}));

jest.mock('../../services/email.service', () => ({
  sendAccountApprovedEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/auth.service', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed'),
}));

import { prisma } from '../../prisma/client';
import { listUsers, createTeacher, approveStudent, deactivateUser, broadcastMessage } from '../admin.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.pagination = { page: 1, limit: 20, skip: 0 };
    next();
  });
  app.get('/users', listUsers);
  app.post('/teachers', createTeacher);
  app.put('/users/:id/approve', approveStudent);
  app.put('/users/:id/deactivate', deactivateUser);
  app.post('/broadcast', broadcastMessage);
  return app;
}

describe('admin.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    it('should list users', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }] as any);
      mockedPrisma.user.count.mockResolvedValue(1);

      const res = await request(createTestApp()).get('/users');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toHaveLength(1);
    });
  });

  describe('POST /teachers', () => {
    it('should create teacher', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.user.create.mockResolvedValue({ id: 'teacher-1', status: 'ACTIVE' } as any);

      const res = await request(createTestApp())
        .post('/teachers')
        .send({ email: 'teacher@test.com', password: 'Password123!', firstName: 'John', lastName: 'Doe' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should reject short password', async () => {
      const res = await request(createTestApp())
        .post('/teachers')
        .send({ email: 'teacher@test.com', password: '123', firstName: 'John', lastName: 'Doe' });

      expect(res.status).toBe(400);
    });

    it('should reject missing fields', async () => {
      const res = await request(createTestApp()).post('/teachers').send({ email: 'teacher@test.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /users/:id/approve', () => {
    it('should approve student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'student-1', status: 'ACTIVE' } as any);

      const res = await request(createTestApp()).put('/users/student-1/approve');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  describe('PUT /users/:id/deactivate', () => {
    it('should ban user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      mockedPrisma.user.update.mockResolvedValue({ id: 'user-1', status: 'BANNED' } as any);

      const res = await request(createTestApp()).put('/users/user-1/deactivate');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('BANNED');
    });
  });

  describe('POST /broadcast', () => {
    it('should broadcast message', async () => {
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }] as any);

      const res = await request(createTestApp()).post('/broadcast').send({ message: 'Hello all' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipients).toBe(1);
    });

    it('should reject empty message', async () => {
      const res = await request(createTestApp()).post('/broadcast').send({});

      expect(res.status).toBe(400);
    });
  });
});
