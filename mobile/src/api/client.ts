import axios from 'axios';
import { Platform } from 'react-native';
import { installRequestInterceptor, installErrorMessageInterceptor } from './interceptors';
import { isApiUnreachableByConfig, resolveApiBase } from './apiBase';

function currentHost(): string | undefined {
  return typeof window !== 'undefined' ? window.location?.hostname : undefined;
}

const API_BASE = resolveApiBase({ os: Platform.OS, hostname: currentHost() });

if (isApiUnreachableByConfig({ os: Platform.OS, hostname: currentHost() })) {
  // Public builds get the plain fact only — a visitor's console is not the
  // place for this project's build or deployment details. The actionable
  // version is dev-only.
  // eslint-disable-next-line no-console
  console.error('[API] No server is configured for this site, so requests cannot succeed.');
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error(`[API] EXPO_PUBLIC_API_URL was not set at build time; falling back to ${API_BASE}.`);
  }
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
