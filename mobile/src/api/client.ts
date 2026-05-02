import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Use host IP — iOS Simulator can reach host via local network
const API_BASE = 'http://192.168.1.143:4000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Network error';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
