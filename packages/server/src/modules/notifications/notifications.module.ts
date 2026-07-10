import { communicationContracts } from '@quran-review/shared';
import { listNotifications, markRead, markAllRead, unreadCount } from '../../services/notification.service';
import { AppError } from '../../middleware/error.middleware';
import { paginate, PaginatedRequest, paginatedResponse } from '../../middleware/pagination.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const list = defineRoute(
  communicationContracts.listNotifications,
  async ({ userId, req }) => {
    const page = (req as PaginatedRequest).pagination?.page ?? 1;
    const limit = (req as PaginatedRequest).pagination?.limit ?? 20;
    const { items, total } = await listNotifications(userId!, page, limit);
    return { status: 200 as const, body: paginatedResponse(items, total, page, limit) };
  },
  { pre: [paginate(20, 100)] }
);

const markOne = defineRoute(communicationContracts.markNotificationRead, async ({ params, userId }) => {
  try {
    const updated = await markRead(String(params.id), userId!);
    return { status: 200 as const, body: { success: true as const, data: updated } };
  } catch (e: unknown) {
    // Service throws plain Error('Notification not found') when id missing or not owned (pinned mapping)
    if (e instanceof Error && e.message === 'Notification not found') {
      throw new AppError(404, 'Notification not found');
    }
    throw e;
  }
});

const markAll = defineRoute(communicationContracts.markAllNotificationsRead, async ({ userId }) => {
  const { count } = await markAllRead(userId!);
  return { status: 200 as const, body: { success: true as const, data: { markedRead: count } } };
});

const unread = defineRoute(communicationContracts.unreadNotificationCount, async ({ userId }) => {
  const count = await unreadCount(userId!);
  return { status: 200 as const, body: { success: true as const, data: { unread: count } } };
});

export const notificationsRouter = buildContractRouter([list, markAll, unread, markOne], {
  mountPrefix: '/api/v1/notifications',
});
