import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE = __DEV__
  ? 'http://localhost:4000/api/v1'
  : 'https://api.education-app.com/api/v1';

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
