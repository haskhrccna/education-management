import { StateCreator } from 'zustand';
import { mmkvStorage } from './mmkvStorage';

// Simple persistence middleware using MMKV
export const persist =
  <T extends object>(config: StateCreator<T>, name: string): StateCreator<T> =>
  (set, get, api) => {
    // Load initial state
    const savedState = mmkvStorage.getItem(name);
    const initialState = savedState ? JSON.parse(savedState) : {};

    // Override config with initial state
    const newSet: typeof set = (partial, replace) => {
      set(partial, replace);
      mmkvStorage.setItem(name, JSON.stringify(get()));
    };

    return config(newSet, get, api);
  };
