import { StateCreator } from 'zustand';
import { mmkvStorage } from './mmkvStorage';

type SetStateInternal<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean
) => void;

export const persist =
  <T extends object>(config: StateCreator<T>, name: string): StateCreator<T> =>
  (set, get, api) => {
    const saved = mmkvStorage.getItem(name);
    const initialState = saved ? JSON.parse(saved) : {};

    const persistedSet: SetStateInternal<T> = (partial, replace) => {
      set(partial as any, replace as any);
      mmkvStorage.setItem(name, JSON.stringify(get()));
    };

    return config(persistedSet as typeof set, get, api);
  };
