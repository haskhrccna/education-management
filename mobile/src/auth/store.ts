import { create } from 'zustand';
import { apiClient } from '../api/client';
import { authApi } from '../api';
import { secureStorage } from '../storage/secureStorage';
import type { AuthUser } from '../api/auth';
export type { AuthUser } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    role: 'student' | 'teacher',
    firstName: string,
    lastName: string
  ) => Promise<void>;
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
      await secureStorage.setItem('auth_token', token);
      if (refreshToken) {
        await secureStorage.setItem('refresh_token', refreshToken);
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
    // Best-effort server revocation — always clear locally regardless of network
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    await secureStorage.deleteItem('auth_token');
    await secureStorage.deleteItem('refresh_token');
    delete apiClient.defaults.headers.common.Authorization;
    set({ user: null, token: null });
  },

  loadSession: async () => {
    try {
      const token = await secureStorage.getItem('auth_token');
      if (token) {
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
        const res = await apiClient.get('/users/profile');
        const profile = res.data;
        set({
          user: {
            ...profile,
            role: profile.role?.toLowerCase() as AuthUser['role'],
            status: profile.status?.toLowerCase() as AuthUser['status'],
          },
          token,
        });
      }
    } catch {
      await secureStorage.deleteItem('auth_token');
      await secureStorage.deleteItem('refresh_token');
      delete apiClient.defaults.headers.common.Authorization;
      set({ user: null, token: null });
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    await apiClient.put('/users/change-password', { currentPassword, newPassword });
  },
}));

// Track in-flight refresh to prevent concurrent refresh races
let refreshPromise: Promise<{ token: string; refreshToken: string }> | null = null;

// 401 interceptor — single-flight token refresh before failing
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Never retry auth endpoints — prevents login/register 401s from triggering refresh
    const url = originalRequest?.url ?? '';
    if (url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/register')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Single-flight: share one refresh call across concurrent 401s
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = await secureStorage.getItem('refresh_token');
            if (!refreshToken) throw new Error('No refresh token');
            const res = await apiClient.post('/auth/refresh', { refreshToken });
            return res.data as { token: string; refreshToken: string };
          })();
        }
        const { token: newToken, refreshToken: newRefreshToken } = await refreshPromise;
        await secureStorage.setItem('auth_token', newToken);
        await secureStorage.setItem('refresh_token', newRefreshToken);
        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        await secureStorage.deleteItem('auth_token');
        await secureStorage.deleteItem('refresh_token');
        delete apiClient.defaults.headers.common.Authorization;
        // Clear in-memory state so UI redirects to login
        useAuthStore.setState({ user: null, token: null });
        return Promise.reject(refreshError);
      } finally {
        refreshPromise = null;
      }
    }
    return Promise.reject(error);
  }
);
