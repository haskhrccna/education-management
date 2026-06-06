// Phase 1 — Notification Center: mobile API client
//
// TODO(phase1-mobile): P0 #2 (broken `apiClient` export in ./client.ts) must be
// fixed before this file can be imported. Once `client.ts` exposes a default
// axios instance, replace the throw below with the real client.
//
// Endpoint contract (already implemented on the server, see
// packages/server/src/routes/notification.routes.ts):
//   GET    /notifications?page=&limit=      -> paginated feed
//   GET    /notifications/unread-count      -> { unread: number }
//   POST   /notifications/read-all          -> { markedRead: number }
//   PATCH  /notifications/:id/read          -> single row, sets readAt

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

function notWired() {
  throw new Error(
    'mobile/src/api/notifications.ts: not yet wired — waiting on P0 #2 fix in ./client.ts'
  );
}

export const notificationsApi = {
  list: async (_page = 1, _limit = 20): Promise<PaginatedNotifications> => notWired(),
  unreadCount: async (): Promise<{ unread: number }> => notWired(),
  markAllRead: async (): Promise<{ markedRead: number }> => notWired(),
  markRead: async (_id: string): Promise<Notification> => notWired(),
};
