import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

const API_BASE = getApiBase();
// eslint-disable-next-line no-console
console.log('[API] baseURL:', API_BASE);
if (Platform.OS === 'ios' && API_BASE.includes('localhost')) {
  // eslint-disable-next-line no-console
  console.warn(
    "[API] Using localhost on iOS. If testing on a physical device, set EXPO_PUBLIC_API_URL to your computer's LAN IP (e.g. http://192.168.1.x:4000/api/v1)"
  );
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

apiClient.interceptors.request.use(async (config) => {
  // Only read SecureStore if header wasn't already set from defaults (saves Keychain I/O per call)
  if (!config.headers.Authorization) {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMsg = error.response?.data?.error;
    if (serverMsg && typeof serverMsg === 'string') {
      error.message = serverMsg;
    }
    return Promise.reject(error);
  }
);

export default apiClient;
