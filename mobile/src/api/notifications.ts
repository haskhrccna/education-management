// Phase 1 — Notification Center: mobile API client
import apiClient from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
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
    const { data } = await apiClient.get('/notifications', { params: { page, limit } });
    return data;
  },
  unreadCount: async (): Promise<{ unread: number }> => {
    const { data } = await apiClient.get('/notifications/unread-count');
    return data;
  },
  markAllRead: async (): Promise<{ markedRead: number }> => {
    const { data } = await apiClient.post('/notifications/read-all');
    return data;
  },
  markRead: async (id: string): Promise<Notification> => {
    const { data } = await apiClient.patch(`/notifications/${id}/read`);
    return data;
  },
};
