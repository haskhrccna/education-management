import { Platform } from 'react-native';
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

/** Storage key the persister below writes the whole cache under — exported so
 * callers (e.g. auth/store.ts's logout) can remove it directly as defense in
 * depth, without hardcoding the string a second time. */
export const QUERY_PERSISTER_KEY = 'rq-cache';

/**
 * Where the cache is written.
 *
 * Native: MMKV, so data is there on cold start — the point of persisting.
 *
 * Web: sessionStorage, which is cleared when the tab closes. MMKV does not
 * exist on web, so mmkvStorage falls back to AsyncStorage, and AsyncStorage on
 * web *is* localStorage — which meant the whole cache (a child's grades,
 * appointments, messages and recording metadata, kept for gcTime: 24h) stayed
 * on the disk of whatever computer was used, surviving the tab and the
 * browser. That is the same exposure secureStorage.ts deliberately moved the
 * auth tokens away from; the data they protect should not outlive them. A web
 * page has no cold start to optimise for anyway — a reload refetches.
 */
const persistStorage = {
  getItem: (key: string) => {
    if (Platform.OS !== 'web') return mmkvStorage.getItem(key);
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null; // private mode / storage blocked
    }
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS !== 'web') return mmkvStorage.setItem(key, value);
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      /* ignore: persistence is an optimisation, never a requirement */
    }
  },
  removeItem: (key: string) => {
    if (Platform.OS !== 'web') return mmkvStorage.removeItem(key);
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const queryPersister = createSyncStoragePersister({
  storage: persistStorage,
  key: QUERY_PERSISTER_KEY,
});

/**
 * Anything this build wrote to localStorage before the change above is still
 * on disk. Clear it once at startup so upgrading actually removes the data
 * rather than just stopping new writes.
 */
export function purgeLegacyWebCache(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(QUERY_PERSISTER_KEY);
  } catch {
    /* storage blocked */
  }
}
