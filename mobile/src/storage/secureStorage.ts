import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// On web there is no secure enclave, so keep tokens per tab: sessionStorage is
// cleared when the tab closes, unlike localStorage, which kept a 7-day refresh
// token on disk for any injected script to find. Reloading the tab keeps the
// sign-in; a new tab or a restarted browser signs in again.
const TOKEN_KEYS = ['auth_token', 'refresh_token'];
let migrated = false;

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!migrated) {
    migrated = true;
    try {
      // Builds before this change wrote tokens to localStorage. Move them into
      // this tab once, then remove them from disk.
      for (const key of TOKEN_KEYS) {
        const legacy = window.localStorage.getItem(key);
        if (legacy !== null && window.sessionStorage.getItem(key) === null) window.sessionStorage.setItem(key, legacy);
        window.localStorage.removeItem(key);
      }
    } catch {
      /* storage blocked (private mode): nothing to migrate */
    }
  }
  return window.sessionStorage;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const webStorage = getWebStorage();
    if (webStorage) return webStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
