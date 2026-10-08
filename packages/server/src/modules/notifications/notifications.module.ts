import { communicationContracts } from '@quran-review/shared';
import { listNotifications, markRead, markAllRead, unreadCount } from '../../services/notification.service';
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
  // The service throws AppError(404) itself now; this handler used to catch a
  // plain Error and re-raise it by matching the message string.
  const updated = await markRead(String(params.id), userId!);
  return { status: 200 as const, body: { success: true as const, data: updated } };
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
