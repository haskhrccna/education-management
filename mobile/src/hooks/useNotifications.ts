import { useCallback, useEffect, useState } from 'react';
import { notificationsApi, Notification } from '../api/notifications';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const fetchNotifications = useCallback(async (nextPage = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.list(nextPage, 20);
      setNotifications((prev) => (nextPage === 1 ? res.data : [...prev, ...res.data]));
      setPage(res.meta.page);
      setHasNext(res.meta.hasNext);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const { unread } = await notificationsApi.unreadCount();
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // best-effort
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const { markedRead } = await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount((c) => Math.max(0, c - markedRead));
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
    fetchUnread();
  }, [fetchNotifications, fetchUnread]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasNext,
    page,
    fetchNotifications,
    fetchUnread,
    markRead,
    markAllRead,
  };
}
