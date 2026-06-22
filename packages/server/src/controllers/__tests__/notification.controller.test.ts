import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/notification.service', () => ({
  listNotifications: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  unreadCount: jest.fn(),
}));

import * as notificationService from '../../services/notification.service';
import { getNotifications, markOneRead, markEveryRead, getUnreadCount } from '../notification.controller';

const mockedService = notificationService as jest.Mocked<typeof notificationService>;

function createApp(userId = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    (req as any).pagination = { page: 1, limit: 20, skip: 0 };
    next();
  });
  app.get('/notifications', getNotifications);
  app.patch('/notifications/:id/read', markOneRead);
  app.post('/notifications/read-all', markEveryRead);
  app.get('/notifications/unread-count', getUnreadCount);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('notification.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /notifications', () => {
    it('returns paginated notifications for authenticated user', async () => {
      mockedService.listNotifications.mockResolvedValue({ items: [{ id: 'n-1' }], total: 1 } as any);

      const res = await request(createApp()).get('/notifications');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.listNotifications).toHaveBeenCalledWith('user-1', 1, 20);
    });

    it('returns 401 when userId is missing', async () => {
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        (req as any).pagination = { page: 1, limit: 20 };
        next();
      });
      app.get('/notifications', getNotifications);
      app.use((err: any, _req: any, res: any, _next: any) =>
        res.status(err.statusCode || 500).json({ error: err.message })
      );

      const res = await request(app).get('/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks a notification as read', async () => {
      mockedService.markRead.mockResolvedValue({ id: 'n-1', readAt: new Date() } as any);

      const res = await request(createApp()).patch('/notifications/n-1/read');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockedService.markRead).toHaveBeenCalledWith('n-1', 'user-1');
    });

    it('returns 404 when notification is not found', async () => {
      mockedService.markRead.mockRejectedValue(new Error('Notification not found'));

      const res = await request(createApp()).patch('/notifications/missing/read');
      expect(res.status).toBe(404);
    });

    it('re-throws non-notification-not-found service errors', async () => {
      mockedService.markRead.mockRejectedValue(new Error('Something else'));

      const res = await request(createApp()).patch('/notifications/n-1/read');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /notifications/read-all', () => {
    it('marks all notifications as read and returns count', async () => {
      mockedService.markAllRead.mockResolvedValue({ count: 5 } as any);

      const res = await request(createApp()).post('/notifications/read-all');

      expect(res.status).toBe(200);
      expect(res.body.data.markedRead).toBe(5);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('returns the unread notification count', async () => {
      mockedService.unreadCount.mockResolvedValue(3);

      const res = await request(createApp()).get('/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body.data.unread).toBe(3);
    });
  });
});
