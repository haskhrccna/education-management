import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/socket.service', () => ({
  notifyNewMessage: jest.fn(),
}));

import { prisma } from '../../prisma/client';
import { getMessages, sendMessage, markRead } from '../message.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

function createTestApp(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    next();
  });
  app.get('/', getMessages);
  app.post('/', sendMessage);
  app.put('/:id/read', markRead);
  return app;
}

describe('message.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should return conversations', async () => {
      mockedPrisma.message.findMany.mockResolvedValue([{ id: 'msg-1', content: 'Hello' }] as any);

      const app = createTestApp('user-1');
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /', () => {
    it('should send message to receiver', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'receiver-1' } as any);
      mockedPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        receiverId: 'receiver-1',
        content: 'Hello',
      } as any);

      const app = createTestApp('user-1');
      const res = await request(app)
        .post('/')
        .send({ receiverId: 'receiver-1', content: 'Hello', type: 'TEXT' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('Hello');
    });

    it('should reject missing receiverId', async () => {
      const app = createTestApp('user-1');
      const res = await request(app)
        .post('/')
        .send({ content: 'Hello' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /:id/read', () => {
    it('should mark message as read for receiver', async () => {
      mockedPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        receiverId: 'user-1',
      } as any);
      mockedPrisma.message.update.mockResolvedValue({ id: 'msg-1', readAt: new Date() } as any);

      const app = createTestApp('user-1');
      const res = await request(app).put('/msg-1/read');

      expect(res.status).toBe(200);
    });

    it('should reject non-receiver', async () => {
      mockedPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        receiverId: 'user-2',
      } as any);

      const app = createTestApp('user-1');
      const res = await request(app).put('/msg-1/read');

      expect(res.status).toBe(403);
    });
  });
});
