import { createMMKV } from 'react-native-mmkv';

type MMKVInstance = ReturnType<typeof createMMKV>;

let storageInstance: MMKVInstance | null = null;

function getStorage(): MMKVInstance {
  if (!storageInstance) {
    storageInstance = createMMKV();
  }
  return storageInstance;
}

export const mmkvStorage = {
  setItem: (key: string, value: string) => {
    getStorage().set(key, value);
  },
  getItem: (key: string) => {
    return getStorage().getString(key) || null;
  },
  removeItem: (key: string) => {
    getStorage().remove(key);
  },
};
