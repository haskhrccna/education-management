import apiClient from './client';

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
    const res = await apiClient.get('/notifications', { params: { page, limit } });
    return res.data;
  },
  unreadCount: async (): Promise<{ unread: number }> => {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data?.data ?? { unread: 0 };
  },
  markAllRead: async (): Promise<{ markedRead: number }> => {
    const res = await apiClient.post('/notifications/read-all');
    return res.data?.data ?? { markedRead: 0 };
  },
  markRead: async (id: string): Promise<Notification> => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data?.data ?? res.data;
  },
};
