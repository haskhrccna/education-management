import { Platform } from 'react-native';
import { createContractClient } from '@quran-review/shared';
import { secureStorage } from '../storage/secureStorage';

/**
 * Contract paths are full canonical ('/api/v1/...'), so the client needs the
 * ORIGIN only — strip the /api/v1 suffix the axios base includes.
 */
function getOrigin(): string {
  const base =
    process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1');
  return base.replace(/\/api\/v1\/?$/, '');
}

const ORIGIN = getOrigin();

/** Server origin (no /api/v1 suffix) for building browser/download URLs. */
export const API_ORIGIN = ORIGIN;

// Single-flight refresh shared across concurrent 401s (mirrors the axios
// installAuthRefreshInterceptor; logout redirect stays with the axios path
// until the auth store adopts the contract client in M10–M12).
let refreshPromise: Promise<string | null> | null = null;

async function refreshAuthToken(): Promise<string | null> {
  try {
    const refreshToken = await secureStorage.getItem('refresh_token');
    if (!refreshToken) return null;
    const res = await fetch(`${ORIGIN}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token: string; refreshToken: string };
    await secureStorage.setItem('auth_token', data.token);
    await secureStorage.setItem('refresh_token', data.refreshToken);
    return data.token;
  } catch {
    return null;
  }
}

/** fetch with bearer injection + one 401 retry after a shared refresh. */
const authFetch: typeof fetch = async (input, init) => {
  const token = await secureStorage.getItem('auth_token');
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const doFetch = () => fetch(input, { ...init, headers });

  let res = await doFetch();
  if (res.status === 401 && !String(input).includes('/api/v1/auth/')) {
    if (!refreshPromise) {
      refreshPromise = refreshAuthToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await doFetch();
    }
  }
  return res;
};

export const contractClient = createContractClient({ baseUrl: ORIGIN, fetchImpl: authFetch });

/** Uniform error surface: throw the server's `error` string like the axios path does. */
export function expectStatus<T extends { status: number; body: unknown }>(res: T, status: number): T {
  if (res.status !== status) {
    const message =
      typeof res.body === 'object' && res.body !== null && 'error' in res.body
        ? String((res.body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res;
}
