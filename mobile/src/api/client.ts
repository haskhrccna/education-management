import axios from 'axios';
import { Platform } from 'react-native';
import { installRequestInterceptor, installErrorMessageInterceptor } from './interceptors';

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api/v1';
  }
  // iOS simulator default; physical devices must set EXPO_PUBLIC_API_URL
  return 'http://localhost:4000/api/v1';
}

/**
 * True when a hosted web build was published without EXPO_PUBLIC_API_URL, so
 * the base URL above fell back to the developer loopback address. The page is
 * then served from a real origin but talks to the visitor's own machine —
 * every request fails with an opaque "Network Error". Detecting it lets the UI
 * say what is actually wrong instead of blaming the user's connection.
 */
export function isApiUnreachableByConfig(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (process.env.EXPO_PUBLIC_API_URL) return false;
  const host = window.location?.hostname ?? '';
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '';
}

const API_BASE = getApiBase();

if (isApiUnreachableByConfig()) {
  // eslint-disable-next-line no-console
  console.error(
    '[API] This site was built without EXPO_PUBLIC_API_URL, so it is calling ' +
      `${API_BASE} — the visitor's own machine. Set the EXPO_PUBLIC_API_URL ` +
      'repository variable to the deployed API and redeploy.'
  );
}
if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[API] baseURL:', API_BASE);
  if (Platform.OS === 'ios' && API_BASE.includes('localhost')) {
    // eslint-disable-next-line no-console
    console.warn(
      "[API] Using localhost on iOS. If testing on a physical device, set EXPO_PUBLIC_API_URL to your computer's LAN IP (e.g. http://192.168.1.x:4000/api/v1)"
    );
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Request auth + server-error-message normalization. The 401 refresh interceptor
// is installed separately by the auth store (it needs the logout side-effect).
installRequestInterceptor(apiClient);
installErrorMessageInterceptor(apiClient);

export default apiClient;
