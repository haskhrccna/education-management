// import { createMMKV } from 'react-native-mmkv';

// type MMKVInstance = ReturnType<typeof createMMKV>;

// let storageInstance: MMKVInstance | null = null;

// function getStorage(): MMKVInstance {
//   if (!storageInstance) {
//     storageInstance = createMMKV();
//   }
//   return storageInstance;
// }

// export const mmkvStorage = {
//   setItem: (key: string, value: string) => {
//     getStorage().set(key, value);
//   },
//   getItem: (key: string) => {
//     return getStorage().getString(key) || null;
//   },
//   removeItem: (key: string) => {
//     getStorage().remove(key);
//   },
// };
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

export const mmkvStorage = {
  setItem: (key: string, value: string) => {
    if (mmkvAvailable) {
      getMMKV().set(key, value);
    } else {
      AsyncStorage.setItem(key, value);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    if (mmkvAvailable) {
      return getMMKV().getString(key) || null;
    }
    return AsyncStorage.getItem(key);
  },
  removeItem: (key: string) => {
    if (mmkvAvailable) {
      getMMKV().remove(key);
    } else {
      AsyncStorage.removeItem(key);
    }
  },
};
