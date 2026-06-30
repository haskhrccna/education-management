import type { AxiosInstance } from 'axios';
import { secureStorage } from '../storage/secureStorage';

/**
 * Attaches the bearer token to outgoing requests when the caller has not
 * already set one (e.g. login/register send no token).
 */
export function installRequestInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use(async (config) => {
    if (!config.headers.Authorization) {
      const token = await secureStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });
}

/**
 * Surfaces the server's `error` field as the thrown error message so UI layers
 * can show a meaningful message instead of axios's generic status text.
 */
export function installErrorMessageInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const serverMsg = error.response?.data?.error;
      if (serverMsg && typeof serverMsg === 'string') {
        error.message = serverMsg;
      }
      return Promise.reject(error);
    }
  );
}

// Track in-flight refresh to prevent concurrent refresh races.
let refreshPromise: Promise<{ token: string; refreshToken: string }> | null = null;

/**
 * Single-flight 401 handling: on the first 401 (outside auth endpoints), refresh
 * the token once, replay the original request, and share that refresh across all
 * concurrent 401s. On refresh failure, clears credentials and invokes
 * `onAuthFailure` so the auth store can redirect to login.
 *
 * The logout side-effect is passed in as a callback rather than imported, so this
 * module never depends on the auth store — keeping the api layer cycle-free.
 */
export function installAuthRefreshInterceptor(client: AxiosInstance, onAuthFailure: () => void): void {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Never retry auth endpoints — prevents login/register/refresh 401s from looping.
      const url = originalRequest?.url ?? '';
      if (url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/register')) {
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          if (!refreshPromise) {
            refreshPromise = (async () => {
              const refreshToken = await secureStorage.getItem('refresh_token');
              if (!refreshToken) throw new Error('No refresh token');
              const res = await client.post('/auth/refresh', { refreshToken });
              return res.data as { token: string; refreshToken: string };
            })();
          }
          const { token: newToken, refreshToken: newRefreshToken } = await refreshPromise;
          await secureStorage.setItem('auth_token', newToken);
          await secureStorage.setItem('refresh_token', newRefreshToken);
          client.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          await secureStorage.deleteItem('auth_token');
          await secureStorage.deleteItem('refresh_token');
          delete client.defaults.headers.common.Authorization;
          onAuthFailure();
          return Promise.reject(refreshError);
        } finally {
          refreshPromise = null;
        }
      }
      return Promise.reject(error);
    }
  );
}
