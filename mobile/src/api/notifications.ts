import { communicationContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const notificationsApi = {
  list: async (page = 1, limit = 20): Promise<PaginatedNotifications> => {
    const res = expectStatus(
      await contractClient.call(communicationContracts.listNotifications, {
        query: { page, limit } as never,
      }),
      200
    );
    return res.body as unknown as PaginatedNotifications;
  },
  unreadCount: async (): Promise<{ unread: number }> => {
    const res = expectStatus(await contractClient.call(communicationContracts.unreadNotificationCount), 200);
    return (res.body as unknown as { data: { unread: number } }).data;
  },
  markAllRead: async (): Promise<{ markedRead: number }> => {
    const res = expectStatus(await contractClient.call(communicationContracts.markAllNotificationsRead), 200);
    return (res.body as unknown as { data: { markedRead: number } }).data;
  },
  markRead: async (id: string): Promise<Notification> => {
    const res = expectStatus(
      await contractClient.call(communicationContracts.markNotificationRead, { params: { id } }),
      200
    );
    return (res.body as unknown as { data: Notification }).data;
  },
};
