import { createMMKV } from 'react-native-mmkv';
import AsyncStorage from '@react-native-async-storage/async-storage';

let storageInstance: ReturnType<typeof createMMKV> | null = null;

function getMMKV() {
  if (!storageInstance) {
    storageInstance = createMMKV();
  }
  return storageInstance;
}

let mmkvAvailable = false;
try {
  getMMKV().set('__test', 'ok');
  mmkvAvailable = getMMKV().getString('__test') === 'ok';
} catch {
  mmkvAvailable = false;
}

// MMKV is synchronous; the only async backend is the AsyncStorage fallback used
// when the native module is unavailable (e.g. web / Expo Go). To keep `getItem`
// synchronous for every caller (settings hydration, zustand persist, the React
// Query persister), the fallback path mirrors values into an in-memory cache,
// hydrated best-effort at startup.
const memCache: Record<string, string | null> = {};
if (!mmkvAvailable) {
  AsyncStorage.getAllKeys()
    .then((keys) => AsyncStorage.multiGet(keys))
    .then((entries) => entries.forEach(([k, v]) => (memCache[k] = v)))
    .catch(() => {
      /* best-effort hydration */
    });
}

export const mmkvStorage = {
  setItem: (key: string, value: string) => {
    if (mmkvAvailable) {
      getMMKV().set(key, value);
    } else {
      memCache[key] = value;
      AsyncStorage.setItem(key, value);
    }
  },
  getItem: (key: string): string | null => {
    if (mmkvAvailable) {
      return getMMKV().getString(key) || null;
    }
    return memCache[key] ?? null;
  },
  removeItem: (key: string) => {
    if (mmkvAvailable) {
      getMMKV().remove(key);
    } else {
      delete memCache[key];
      AsyncStorage.removeItem(key);
    }
  },
};
