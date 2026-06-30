import { create } from 'zustand';
import { apiClient } from '../api/client';
import { authApi } from '../api/auth';
import { installAuthRefreshInterceptor } from '../api/interceptors';
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

// Single-flight 401 token refresh. Registered here (not in client.ts) because the
// logout side-effect needs the auth store; passed as a callback so interceptors.ts
// stays free of any store import.
installAuthRefreshInterceptor(apiClient, () => {
  // Clear in-memory state so UI redirects to login
  useAuthStore.setState({ user: null, token: null });
});
