import { create } from 'zustand';
import { apiClient } from '../api/client';
import { authApi } from '../api/auth';
import { installAuthRefreshInterceptor } from '../api/interceptors';
import { secureStorage } from '../storage/secureStorage';
import { mmkvStorage } from '../storage/mmkvStorage';
import { queryClient, QUERY_PERSISTER_KEY } from '../lib/queryClient';
import {
  BIOMETRIC_ENABLED_KEY,
  biometricText,
  getBiometricStatus,
  promptForBiometrics,
  setBiometricPreference,
} from './biometric';
import type { AuthUser } from '../api/auth';
export type { AuthUser } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isBiometricEnabled: boolean;
  biometricLabel: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithBiometrics: (isAr?: boolean) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    role: 'student' | 'teacher',
    firstName: string,
    lastName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  refreshBiometricStatus: (isAr?: boolean) => Promise<void>;
  enableBiometricLogin: (isAr?: boolean) => Promise<void>;
  disableBiometricLogin: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** F5: locally mirror the server's onboarding stamp so the gate stops redirecting. */
  markOnboarded: () => void;
}

function normalizeUser(profile: any): AuthUser {
  return {
    ...profile,
    role: profile.role?.toLowerCase() as AuthUser['role'],
    status: profile.status?.toLowerCase() as AuthUser['status'],
  };
}

async function restoreSessionFromStorage(set: (state: Partial<AuthState>) => void): Promise<AuthUser> {
  let token = await secureStorage.getItem('auth_token');

  if (!token) {
    const refreshToken = await secureStorage.getItem('refresh_token');
    if (refreshToken) {
      const refreshed = await authApi.refresh(refreshToken);
      token = refreshed.token;
      await secureStorage.setItem('auth_token', refreshed.token);
      await secureStorage.setItem('refresh_token', refreshed.refreshToken);
    }
  }

  if (!token) {
    throw new Error('No stored session');
  }

  apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  const res = await apiClient.get('/users/profile');
  const user = normalizeUser(res.data);
  const currentToken = (await secureStorage.getItem('auth_token')) ?? token;
  set({ user, token: currentToken, isLoading: false });
  return user;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isBiometricEnabled: false,
  biometricLabel: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { user, token, refreshToken } = await authApi.login(email, password);
      await secureStorage.setItem('auth_token', token);
      if (refreshToken) {
        await secureStorage.setItem('refresh_token', refreshToken);
      }
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
      const biometricStatus = await getBiometricStatus();
      if (biometricStatus.enabled && !biometricStatus.available) {
        await setBiometricPreference(false);
      }
      set({
        user,
        token,
        isLoading: false,
        isBiometricEnabled: biometricStatus.enabled && biometricStatus.available,
        biometricLabel: biometricStatus.label,
      });
      return user;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loginWithBiometrics: async (isAr = false) => {
    set({ isLoading: true });
    try {
      const status = await getBiometricStatus(isAr);
      set({
        isBiometricEnabled: status.enabled && status.available && status.hasStoredSession,
        biometricLabel: status.label,
      });
      if (!status.enabled || !status.available || !status.hasStoredSession) {
        throw new Error(status.reason ?? biometricText('biometricUnavailable', isAr));
      }
      await promptForBiometrics(isAr, status.label);
      return await restoreSessionFromStorage(set);
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
    await secureStorage.deleteItem(BIOMETRIC_ENABLED_KEY);
    delete apiClient.defaults.headers.common.Authorization;
    // Defense in depth: sensitive query results (e.g. audit-log rows) should
    // already be excluded from persistence via dehydrateOptions, but clear
    // the in-memory cache and the persisted MMKV blob directly too, so
    // nothing from this session survives past logout.
    queryClient.clear();
    mmkvStorage.removeItem(QUERY_PERSISTER_KEY);
    set({ user: null, token: null, isBiometricEnabled: false, biometricLabel: null });
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const status = await getBiometricStatus();
      set({
        isBiometricEnabled: status.enabled && status.available && status.hasStoredSession,
        biometricLabel: status.label,
      });
      if (status.enabled && status.hasStoredSession) {
        delete apiClient.defaults.headers.common.Authorization;
        set({ user: null, token: null, isLoading: false });
        return;
      }
      await restoreSessionFromStorage(set);
    } catch {
      await secureStorage.deleteItem('auth_token');
      await secureStorage.deleteItem('refresh_token');
      delete apiClient.defaults.headers.common.Authorization;
      set({ user: null, token: null, isLoading: false });
    }
  },

  refreshBiometricStatus: async (isAr = false) => {
    const status = await getBiometricStatus(isAr);
    set({
      isBiometricEnabled: status.enabled && status.available && status.hasStoredSession,
      biometricLabel: status.label,
    });
  },

  enableBiometricLogin: async (isAr = false) => {
    const status = await getBiometricStatus(isAr);
    if (!status.available) {
      throw new Error(status.reason ?? biometricText('biometricUnavailable', isAr));
    }
    if (!status.hasStoredSession) {
      throw new Error(biometricText('biometricPasswordFirst', isAr));
    }
    await promptForBiometrics(isAr, status.label);
    await setBiometricPreference(true);
    set({ isBiometricEnabled: true, biometricLabel: status.label });
  },

  disableBiometricLogin: async () => {
    await setBiometricPreference(false);
    set({ isBiometricEnabled: false });
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    await apiClient.put('/users/change-password', { currentPassword, newPassword });
  },

  markOnboarded: () => {
    set((s) => (s.user ? { user: { ...s.user, onboardingCompletedAt: new Date().toISOString() } } : {}));
  },
}));

// Single-flight 401 token refresh. Registered here (not in client.ts) because the
// logout side-effect needs the auth store; passed as a callback so interceptors.ts
// stays free of any store import.
installAuthRefreshInterceptor(apiClient, () => {
  // Clear in-memory state so UI redirects to login
  useAuthStore.setState({ user: null, token: null });
});
