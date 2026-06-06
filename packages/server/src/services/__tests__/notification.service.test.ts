import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Mock the socket/email/push services that notifyUser dynamically imports.
jest.mock('../../services/socket.service', () => ({ sendToUser: jest.fn() }));
jest.mock('../../services/email.service', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/fcm.service', () => ({ sendPushToUser: jest.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../prisma/client';
import {
  notifyUser,
  listNotifications,
  markRead,
  markAllRead,
  unreadCount,
} from '../notification.service';

const m = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('notification.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('notifyUser — durable persistence', () => {
    it('persists a Notification row on every call (event as type, push title/body)', async () => {
      m.notification.create.mockResolvedValue({} as any);

      await notifyUser({
        userId: 'user-1',
        event: 'appointment_update',
        data: { appointmentId: 'apt-1' },
        push: { title: 'Appointment accepted', body: 'Your appointment is on Monday' },
      });

      expect(m.notification.create).toHaveBeenCalledTimes(1);
      const arg = m.notification.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        userId: 'user-1',
        type: 'appointment_update',
        title: 'Appointment accepted',
        body: 'Your appointment is on Monday',
      });
      expect(arg.data.data).toEqual({ appointmentId: 'apt-1' });
    });

    it('falls back to email subject/body when no push payload is provided', async () => {
      m.notification.create.mockResolvedValue({} as any);

      await notifyUser({
        userId: 'user-2',
        event: 'new_grade',
        data: { subject: 'Tajweed' },
        email: { subject: 'New grade: Tajweed', body: '<p>A new grade</p>' },
      });

      const arg = m.notification.create.mock.calls[0][0];
      expect(arg.data.title).toBe('New grade: Tajweed');
      // HTML stripped, trimmed, ≤ 280 chars
      expect(arg.data.body).toBe('A new grade');
    });

    it('does NOT throw when persistence fails (best-effort)', async () => {
      m.notification.create.mockRejectedValue(new Error('DB down'));

      // Should resolve, not reject — the original socket/email/push path must keep working
      await expect(
        notifyUser({
          userId: 'user-3',
          event: 'new_message',
          data: { content: 'hi' },
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('listNotifications', () => {
    it('returns paginated items ordered by createdAt desc, scoped to the user', async () => {
      m.notification.findMany.mockResolvedValue([{ id: 'n1' }, { id: 'n2' }] as any);
      m.notification.count.mockResolvedValue(7);

      const { items, total } = await listNotifications('user-1', 2, 5);

      expect(items).toHaveLength(2);
      expect(total).toBe(7);
      expect(m.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 5, // (page-1) * limit = (2-1)*5
        take: 5,
      });
    });
  });

  describe('markRead', () => {
    it('updates the notification when it exists and belongs to the user', async () => {
      m.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'user-1' } as any);
      m.notification.update.mockResolvedValue({ id: 'n1', readAt: new Date() } as any);

      const result = await markRead('n1', 'user-1');

      expect(result.id).toBe('n1');
      expect(m.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { readAt: expect.any(Date) },
      });
    });

    it('throws when the notification does not exist', async () => {
      m.notification.findUnique.mockResolvedValue(null);

      await expect(markRead('missing', 'user-1')).rejects.toThrow('Notification not found');
      expect(m.notification.update).not.toHaveBeenCalled();
    });

    it('throws when the notification belongs to a different user (no cross-user read)', async () => {
      m.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'other-user' } as any);

      await expect(markRead('n1', 'user-1')).rejects.toThrow('Notification not found');
      expect(m.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('updates only the caller unread rows', async () => {
      m.notification.updateMany.mockResolvedValue({ count: 4 } as any);

      const { count } = await markAllRead('user-1');

      expect(count).toBe(4);
      expect(m.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('unreadCount', () => {
    it('counts only rows where readAt is null, scoped to the user', async () => {
      m.notification.count.mockResolvedValue(3);

      const count = await unreadCount('user-1');

      expect(count).toBe(3);
      expect(m.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
    });
  });
});
