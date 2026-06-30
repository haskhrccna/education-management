import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { mmkvStorage } from '../storage/mmkvStorage';

/**
 * App-wide React Query client. Server state (grades, appointments, recordings,
 * …) lives here instead of in per-hook useState + manual MMKV caches.
 *
 * - staleTime 1m: cached data renders instantly, then refetches in the background.
 * - gcTime 24h: keeps cache around long enough for the persister to be useful.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Persists the query cache to MMKV (synchronous) so data is available on cold
 * start — replacing the hand-rolled per-hook MMKV caches.
 */
export const queryPersister = createSyncStoragePersister({
  storage: {
    getItem: (key) => mmkvStorage.getItem(key),
    setItem: (key, value) => mmkvStorage.setItem(key, value),
    removeItem: (key) => mmkvStorage.removeItem(key),
  },
  key: 'rq-cache',
});
