import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../api/client';
import { authApi } from '../api';

export interface AuthUser {
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
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { user, token, refreshToken } = await authApi.login(email, password);
      await SecureStore.setItemAsync('auth_token', token);
      if (refreshToken) {
        await SecureStore.setItemAsync('refresh_token', refreshToken);
      }
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
      set({ user, token, isLoading: false });
      return user;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email, password, role, firstName, lastName) => {
    set({ isLoading: true });
    try {
      await authApi.register({ email, password, role, firstName, lastName });
    } catch (err) {
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
    delete apiClient.defaults.headers.common.Authorization;
    set({ user: null, token: null });
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
        const res = await apiClient.get('/users/profile');
        set({ user: res.data, token });
      }
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('refresh_token');
      delete apiClient.defaults.headers.common.Authorization;
      set({ user: null, token: null });
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    await apiClient.put('/users/change-password', { currentPassword, newPassword });
  },
}));

// 401 interceptor — attempt token refresh before failing
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await apiClient.post('/auth/refresh', { refreshToken });
        const { token: newToken, refreshToken: newRefreshToken } = res.data;
        await SecureStore.setItemAsync('auth_token', newToken);
        await SecureStore.setItemAsync('refresh_token', newRefreshToken);
        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
        delete apiClient.defaults.headers.common.Authorization;
      }
    }
    return Promise.reject(error);
  }
);
