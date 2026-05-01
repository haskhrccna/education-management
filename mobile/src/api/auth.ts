import apiClient from './client';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  status: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<{ user: AuthUser; token: string; refreshToken: string }> => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  register: async (data: { email: string; password: string; role: string; firstName: string; lastName: string }) => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<{ token: string; refreshToken: string }> => {
    const res = await apiClient.post('/auth/refresh', { refreshToken });
    return res.data;
  },
};
