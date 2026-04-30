import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_BASE = __DEV__
  ? 'http://localhost:4000/api'
  : 'https://api.education-app.com/api';

axios.defaults.baseURL = API_BASE;
axios.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  firstName: string;
  lastName: string;
  status: 'pending' | 'approved' | 'active' | 'banned';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, role: 'student' | 'teacher', firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await axios.post('/auth/login', { email, password });
      const { user, token } = res.data;
      await SecureStore.setItemAsync('auth_token', token);
      set({ user, token, isLoading: false });
      return user;
    } catch (err) {
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  register: async (email, password, role, firstName, lastName) => {
    set({ isLoading: true });
    try {
      await axios.post('/auth/register', { email, password, role, firstName, lastName });
    } catch (err) {
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    delete axios.defaults.headers.common.Authorization;
    set({ user: null, token: null });
  },
  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        const res = await axios.get('/users/profile');
        set({ user: res.data, token });
      }
    } catch {
      // Invalid/expired token — clear session
      await SecureStore.deleteItemAsync('auth_token');
      delete axios.defaults.headers.common.Authorization;
      set({ user: null, token: null });
    }
  },
}));
