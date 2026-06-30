import { useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { notificationsApi, PaginatedNotifications } from '../api/notifications';

const LIST_KEY = ['notifications', 'list'];
const UNREAD_KEY = ['notifications', 'unread'];

export function useNotifications() {
  const qc = useQueryClient();

  const q = useInfiniteQuery<PaginatedNotifications>({
    queryKey: LIST_KEY,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam as number, 20),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNext ? last.meta.page + 1 : undefined),
  });

  const unreadQ = useQuery({ queryKey: UNREAD_KEY, queryFn: () => notificationsApi.unreadCount() });

  const notifications = q.data?.pages.flatMap((p) => p.data) ?? [];
  const lastPage = q.data?.pages[q.data.pages.length - 1];

  // (1) refreshes the list; anything else loads the next page.
  const fetchNotifications = useCallback(
    async (nextPage = 1) => {
      if (nextPage === 1) {
        await q.refetch();
      } else {
        await q.fetchNextPage();
      }
    },
    [q.refetch, q.fetchNextPage]
  );

  const fetchUnread = useCallback(async () => {
    await unreadQ.refetch();
  }, [unreadQ.refetch]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await notificationsApi.markRead(id);
        qc.setQueryData<InfiniteData<PaginatedNotifications>>(LIST_KEY, (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  data: p.data.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
                })),
              }
            : old
        );
        qc.setQueryData<{ unread: number }>(UNREAD_KEY, (u) => ({ unread: Math.max(0, (u?.unread ?? 1) - 1) }));
      } catch {
        // best-effort
      }
    },
    [qc]
  );

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      const now = new Date().toISOString();
      qc.setQueryData<InfiniteData<PaginatedNotifications>>(LIST_KEY, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                data: p.data.map((n) => ({ ...n, readAt: n.readAt ?? now })),
              })),
            }
          : old
      );
      qc.setQueryData<{ unread: number }>(UNREAD_KEY, { unread: 0 });
    } catch {
      // best-effort
    }
  }, [qc]);

  return {
    notifications,
    unreadCount: unreadQ.data?.unread ?? 0,
    isLoading: q.isLoading || q.isFetchingNextPage,
    error: q.error ? (q.error as Error).message : null,
    hasNext: q.hasNextPage,
    page: lastPage?.meta.page ?? 1,
    fetchNotifications,
    fetchUnread,
    markRead,
    markAllRead,
  };
}
